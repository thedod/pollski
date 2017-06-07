var Mastodon = require('mastodon'),
    sanitizeHtml = require('sanitize-html'),
    BLAKE2s = require('blake2s'),
    Datastore = require('nedb');

var masto,
    db = new Datastore({ filename: '.data/datafile', autoload: true });

try {
  masto = new Mastodon({
    'access_token': process.env.MASTODON_ACCESS_TOKEN,
    'api_url': process.env.MASTODON_API || 'https://botsin.space/api/v1/'
  });
  console.log("Ready to toot!");
} catch(err) {
  console.error(err);
  console.error("Sorry, your .env file does not have the correct settings in order to toot");
}

function b64Hash(s) {
  var h = new BLAKE2s(32, process.env.HASH_SALT.slice(0,32));
  h.update(s);
  return h.digest('base64');
}

// https://stackoverflow.com/a/17076120
// Not perfect, but [hopefully] good enough for the cases we deal with here
function decodeHTMLEntities(text) {
    var entities = [
        ['amp', '&'],
        ['apos', '\''],
        ['#x27', '\''],
        ['#x2F', '/'],
        ['#39', '\''],
        ['#47', '/'],
        ['lt', '<'],
        ['gt', '>'],
        ['nbsp', ' '],
        ['quot', '"']
    ];

    for (var i = 0, max = entities.length; i < max; ++i) 
        text = text.replace(new RegExp('&'+entities[i][0]+';', 'g'), entities[i][1]);

    return text;
};

function promiseLastNotice(options) {
  return new Promise(function(resolve, reject) {
    var val = 0;
    db.findOne({_id: "last_notice"}, function(err, doc) {
      if(err) {
        reject(err);
      } else if (!doc) {
        db.insert({_id: "last_notice", value: val});
      } else {
        val = doc.value || 0;
      };
      if (options && options.set) {
        db.update({_id: "last_notice"}, {$set: {value: options.set}});
      };
      resolve(val);
    });
  });
};

function promisePoll(poll_id) {
  return new Promise(function(resolve, reject) {
    db.findOne({type: "poll", poll_id: poll_id}, function(err, doc) {
      if (err) {
        console.error(err);
        reject("Database problem");
      } else if (!doc) {
        reject(`Poll not found: "${poll_id}"`);
      } else {
        resolve(doc);
      }
    });
  });
}

function promiseVote(poll_id, acct_hash, optional_choice) {
  return new Promise(function(resolve, reject) {
    db.findOne({type: "vote", poll_id: poll_id, acct_hash: acct_hash}, function(err, doc) {
      if (err) {
        console.error(err);
        reject("Database problem");
      } else if (doc) {
        if (optional_choice) {
          db.update(doc, {$set: {choice: optional_choice}}, function(err, numAffected, affectedDocs) {
            if (err) {
              console.error(err);
              reject("Database problem");
            } else {
              resolve(doc.choice);
            }
          });
        } else {
          resolve(doc.choice);
        };
      } else {
        var newdoc = {
          type: "vote", poll_id: poll_id, acct_hash: acct_hash,
          choice: optional_choice || 0
        };
        db.insert(newdoc, function(err, doc) {
          if (err) {
            console.error(err);
            reject("Database problem");
          } else {
            resolve(0); // No previous choice
          }
        });
      };
    });
  });
}

function promiseCount(poll_id, choice) {
  return new Promise(function(resolve, reject) {
    db.count({ type: "vote", poll_id: poll_id, choice: choice }, function(err, count) {
      if (err) {
        console.error(err);
        reject("Database problem");
      } else {
        resolve(count);
      };
    });
  })
}

function promisePollResults(poll) {
  return new Promise(function(resolve, reject) {
    var results = [],
        total = 0;
    poll.answers.forEach(function(answer, index) {
      promiseCount(poll.poll_id, index+1).then(function(count) {
        results.push({choice: answer, count: count});
        total += count;
        if (index+1===poll.answers.length) {
          var reply = `Current results for ${poll.poll_id} by ${poll.creator||undefined} (${total} vote${total!==1?'s':''}):
${poll.question}\n\n`;
          results.forEach(function(entry, index) {
            reply += `${index+1}) ${entry.count}${total&&entry.count? ` (${(entry.count*100.00/total).toFixed(0)}%)`: ''}: ${entry.choice}\n`;
          });
          resolve(reply);
        }
      }).catch(function(err) { reject(err); });
    })
  });
}

function promiseReplyPrefix(status_id) {
  return new Promise(function(resolve, reject) {
    db.findOne({type: "reply_prefix", status_id: status_id}, function(err, doc) {
      if (doc) {
        resolve(doc.prefix);
      } else {
        resolve([]);
      }
    });
  });
}

function describePoll(poll) {
  var enum_answers = poll.answers.map((line, index)=>`${index+1}) ${line}`).join('\n');
  return `${poll.question}
(Reply with a number between 1 and ${poll.answers.length})
${enum_answers}

Created by: ${poll.creator || 'undefined'}`;
}

function postToot(options, reply_prefix){
  return new Promise(function(resolve, reject) {
    //console.log("Tooting!");
    options.status = decodeHTMLEntities(options.status || "");
    if (options.status.length>500) {
      options.status = options.status.slice(0,497)+'...';
    }
    masto.post('statuses', options, function(err, data, response) {
      if (err) {
        console.error(err);
        reject("Couldn't toot");
      } else {
        if (options.visibility==="direct") { // direct messages expire after 24h
          db.insert({
            type: "expiry", status_id: data.id,
            expires: Date.now()+24*60*60*1000
          });
        }
        if (reply_prefix && reply_prefix.length) {
          db.insert({
            type: "reply_prefix", status_id: data.id,
            prefix: reply_prefix
          });
        }
        resolve(data);
      }
    });    
  });
}

var command_handlers = {
  /* --------- in case of emergency, break glass
  "gump": function(acct, lines) {
    return new Promise(function (resolve, reject) {
      db.find({}, function(err, docs) {
        if (docs) {
          docs.forEach(function(doc) {
            console.log(JSON.stringify(doc));
          });
        };
        resolve({reply:"Done"});
      });
    });
  },
  ----------------------- */
  "recommend": function(acct, lines) {
    return new Promise(function (resolve, reject) {
      if(!(lines.length && lines[0].length===1)) {
        reject(`invalid arguments for "create": "${lines[0].join(' ')}"`);
      } else {
        promisePoll(lines[0][0]).then(function(poll) {
          postToot(
            {
              status: `The poll "${poll.question}" is recommended by ${acct}:
${lines.slice(1).map(tokens=>tokens.join(' ')).join('\n')}

To participate, reply to this with an empty toot.
Note: It is recommended to set the reply's visibility to "direct".
For more information: see https://glitch.com/~pollski`,
              spoiler_text: `Poll recommendation: ${poll.poll_id}`
            },
            ["poll", poll.poll_id]
          ).then(function(toot) { resolve({reply:`👍 ${toot.url}`}); });
        }).catch(function(err) { reject(err); });
      }
    });
  },
  "create": function(acct, lines) {
    return new Promise(function (resolve, reject) {
      if (!(lines.length && lines[0].length===1)) {
        reject(`invalid arguments for "create": "${lines[0].join(' ')}"`);
      } else if (lines.length<4) {
        reject('You need at least 2 answers to choose from');
      } else {
        var poll_id = lines[0][0];
        promisePoll(poll_id).then(function() {
          reject(`A poll promise id "${poll_id}" already exists`);
        }).catch(function(err) {
          if (err.startsWith('Poll not found')) {
            var poll = {
              type: "poll",
              poll_id: poll_id,
              creator: acct,
              question: lines[1].join(' '),
              answers: lines.slice(2).map(tokens=>tokens.join(' '))
            };
            db.insert(poll);
            resolve({reply:describePoll(poll), prefix:["vote", poll_id]});                        
          } else {
            reject(err);
          }
        });
      };
    });    
  },
  "poll": function(acct, lines) {
    return new Promise(function (resolve, reject) {
      if (!(lines.length && lines.length===1 && lines[0].length===1)) {
        reject(`invalid arguments for "poll": "${lines[0].join(' ')}"`);
      } else {
        promisePoll(lines[0][0]).then(function(poll) {
          promiseVote(poll.poll_id, b64Hash(acct)).then(function(choice) {
            if (choice) {
              promisePollResults(poll).then(function(results) {
                resolve({reply: results, prefix:["vote", poll.poll_id]})
              }).catch(function(err) { reject(err); });
            } else {
              resolve({reply:describePoll(poll), prefix:["vote", poll.poll_id]});
            };
          }).catch(function(err) { reject(err); });
        }).catch(function(err) { reject(err); });
      }
    });
  },
  "vote": function(acct, lines) {
    return new Promise(function (resolve, reject) {
      if (!(lines.length && lines.length===1 && lines[0].length===2 && parseInt(lines[0][1])>0)) {
        reject(`invalid arguments for "vote": "${lines[0].join(' ')}"`);
      } else {
        promisePoll(lines[0][0]).then(function(poll) {
          var poll_id = poll.poll_id;
          var choice = parseInt(lines[0][1]); // we know it's >0, so not NaN.
          if (choice>poll.answers.length) {
            reject(`Invalid choice for "${poll_id}": "${choice}"`);
          } else {
            promiseVote(poll_id, b64Hash(acct), choice).then(function(previous_choice) {
              if (previous_choice) {
                if (previous_choice===choice) {
                  promisePollResults(poll).then(function(results) {
                    resolve({reply:`Your vote remains ${choice}.\n\n`+results, prefix:["vote", poll_id]});
                  }).catch(function(err) { reject(err); });
                } else {
                  promisePollResults(poll).then(function(results) {
                    resolve({
                      reply: `${results}

You've changed your vote from ${previous_choice} to ${choice}.`,
                      prefix: ["vote", poll_id]
                    });
                  }).catch(function(err) { reject(err); });
                }
              } else {
                promisePollResults(poll).then(function(results) {
                  resolve({
                    reply: `${results}
You have voted ${choice}.`,
                    prefix: ["vote", poll_id]
                  });
                }).catch(function(err) { reject(err); });
              }
            }).catch(function(err) { reject(err); });
          }
        }).catch(function(err) { reject(err); });
      }
    });
  },
  "destroy": function(acct, lines) {
    return new Promise(function (resolve, reject) {
      if (!(lines.length && lines.length===1 && lines[0].length===1)) {
        reject(`invalid arguments for "destroy": "${lines[0].join(' ')}"`);
      } else {
        promisePoll(lines[0][0]).then(function(poll) {
          if (poll.creator===acct || process.env.ADMINS.indexOf(acct)>=0) {
             db.remove(
              {type: {$in: ["poll", "vote"]}, poll_id: poll.poll_id},
              {multi: true}, function(err, numRemoved) {
                if (err) {
                  reject(err);
                } else {
                  if (numRemoved) {
                    resolve({
                      reply: `removed the ${poll.poll_id} poll, and ${numRemoved-1} vote${numRemoved===2?"":"s"}.`});
                  } else {
                    resolve({reply: `poll "${poll.poll_id}" not found.`});
                  }
                }
              }
            );          
          } else {
            reject(`You're not the creator of the ${poll.poll_id} poll.`);
          }
        });           
      }     
    });
  },
  "untoot": function(acct, lines) {
    return new Promise(function (resolve, reject) {
      if (!(lines.length && lines.length===1 && lines[0].length===1)) {
        reject(`invalid arguments for "untoot": "${lines[0].join(' ')}"`);
      } else {
        var status_id = lines[0][0].split('/').pop();
        masto.get(`statuses/${status_id}`, function (err, data, response) {
          if (err) {
            console.log(err);
            reject(`Couldn't find recommendation toot ${status_id}`);
          } else if (data.account.acct!==process.env.BOT_USERNAME) {
            reject(`Toot ${status_id} is not by this bot (go home, script kiddie).`);
          } else if (data.content.search(acct)<0 && process.env.ADMINS.indexOf(acct)<0) {
            reject(`Toot ${status_id} is not a recommendation of yours (go home, script kiddie).`);            
          } else {
            masto.delete(`statuses/${status_id}`, function(err, data, response) {
              if (err) {
                reject(err);
              } else {
                resolve({reply: `Recommendation ${status_id} deleted successfully.`});
              }
            });
          }
        });
      };
    });
  },
}

module.exports.tick = function() {
  if (!masto){
    console.error("Sorry, you haven't setup Mastodon yet in your .env");
    return false;
  }
  promiseLastNotice().then(function(last_id) {    
    console.log("last id",last_id);
    masto.get('notifications', {since_id: last_id}).then(function(resp) {
      var max_id = last_id;
      resp.data.forEach(function(notification) {
        max_id = Math.max(max_id,notification.id);
        if (notification.type==="mention") {
          promiseReplyPrefix(notification.status.in_reply_to_id).then(function(reply_prefix) {
            var acct = notification.account.acct,
                status = sanitizeHtml(notification.status.content, {allowedTags:['br','p']}),
                lines = status.replace(/<\/?p>/g,'<br />').split('<br />')
                          .map(line => line.split(' ').filter(same=>same)).filter(vec=>vec.length);
            lines[0].shift(); // drop mention
            if (lines[0][0]==="untoot") {
              if (lines[0].length===1 && notification.status.in_reply_to_id) {
                lines[0].push(notification.status.in_reply_to_id.toString());
              };
            } else {
              lines[0] = reply_prefix.concat(lines[0]);
            };
            var command = lines[0].length? lines[0].shift(): "";
            console.log(`${acct}: ${command}\n${lines.map(tokens=>tokens.join(' ')).join('\n')}`);
            var handler = command_handlers[command];
            if (handler) {
              handler(acct, lines).then(function(response) {
                postToot(
                  {
                    status: `@${acct} ${response.reply}`,
                    spoiler_text: `re: ${command}`,
                    in_reply_to_id: notification.status.id,
                    visibility: "direct"
                  },
                  response.prefix || []
                );
              }).catch(function(err) {
                postToot({
                  status: `@${acct} ${err}`,
                  spoiler_text: `Error (${command})`,
                  in_reply_to_id: notification.status.id,
                  visibility: "direct"
                });              
              });
            } else {
              postToot({
                status: `@${acct} Unknown command: "${command}"\nSee https://glitch.com/~pollski for instructions.`,
                spoiler_text: 'Syntax error',
                in_reply_to_id: notification.status.id,
                visibility: "direct"
              });
            };
          });
        };
      });
      // Remove notifications (to prevent bot admin from reading them)
      masto.post('notifications/clear'); // race condition liability, but "dismiss" didn't work :(
      // Outgoing direct messages can also be viewed by admin. The least we can do:
      // * Content warning against accidental exposure to data
      // * Remove outgoing direct statuses after 24 hours
      db.find({type: "expiry", expires: {$lt: Date.now()}}, function(err, docs) {
        if (err) {
          console.error(err);
        } else if (docs.length) {
          docs.forEach(function(doc) {
            masto.delete(`statuses/${doc.status_id}`);
            db.remove(doc);
          });
        };
      });
      if (max_id) { // otherwise we'd toot entire history again
        promiseLastNotice({set:max_id});        
      };
    });
  }).catch(function(err){console.error(err)});
  return true;
}
