## Pollski: a Mastodon pollster bot

![logo](https://cdn.glitch.com/f0a98492-b168-4c48-9546-fc6646c830fb%2Fpollski.png?1496420994865)

This app controls the [Pollski](https://botsin.space/@pollski) mastodon bot.

To interact with the bot (vote, create polls, etc.), you toot<sup>[1]</sup> to
`@pollski@botsin.space` from a
[mastodon](https://en.wikipedia.org/wiki/Mastodon_(software))
account<sup>[2]</sup>,
or — even simpler — reply to its toots.

**Note**: When tooting to the bot, it is advised to set the toot's `visibility` to `direct` (otherwise, what you tell the bot becomes public).

![visibilty: direct](https://cdn.glitch.com/f0a98492-b168-4c48-9546-fc6646c830fb%2Fvisibility-direct.jpg?1496750777298)

If you reply to a toot *by* the bot (except for *recommendation* toots — see below), `direct` is the default, since the bot always toots directly (except for recommendations, of course).

### Corresponding with the bot

The only public toots in the bot's [timeline](https://botsin.space/@pollski/) are *recommendations* ([example](https://botsin.space/@pollski/202074)).

If you respond to such a toot with an empty toot (remember to set the `visibility` to `direct`):

* If you haven't voted yet, you'll get in reply a toot like
  ```
  Why did the chicken cross the road?
  (Reply with a number between 1 and 3)
  1) To get to the other side.
  2) The road tried to cross the chicken, but the chicken was faster.
  3) Other...
  ```
  to which you can reply with 1, 2, or 3
  (no need to set `visibility` to `direct`).
  In return, the bot will show you the current poll results
  (see example below).
  
* If you've already voted, you'll get poll results that look like this:
  ```
  Current results for WhyChicken by thedod@weho.st (5 votes):
  Why did the chicken cross the road?

  1) 0: To get to the other side.
  2) 4 (80%): The road tried to cross the chicken, but the chicken was faster.
  3) 1 (20%): Other...
  ```
  If you've changed your mind, you can reply to this with some *other* number
  between 1 and 3, and get the updated poll results in return.
  
### Explicit Commands

So far, we've seen how to interact with a bot by replying to its toots.
You can also toot to the bot on your own initiative by using the commands described below (remember to set toot's `visibility` to `direct`).

#### Poll
Example: `@pollski@botsin.space poll WhyChicken`.

The robot replies depending on whether you have voted in the `WhyChicken` poll or not:

* If you haven't voted yet, shows the question and choices,
  and instructs how to vote.
* Otherwise, shows current poll results.

#### Vote
Example: `@pollski@botsin.space vote WhyChicken 2`.

You can vote again if you change your mind, but you only count as a single vote 😉

#### Create

Example:

```
@pollski@botsin.space create WhyChicken
Why did the chicken cross the road?
To get to the other side.
The road tried to cross the chicken, but the chicken was faster.
Other...
```

The bot replies with the poll's description. In this example:

```
Why did the chicken cross the road?
(Reply with a number between 1 and 3)
1) To get to the other side.
2) The road tried to cross the chicken, but the chicken was faster.
3) Other...
```

#### Recommend

In order to easily publicize a poll, you can toot:

```
@pollski@botsin.space recommend WhyChicken
It's a fun poll about https://en.wikipedia.org/wiki/Why_did_the_chicken_cross_the_road%3F
```

The bot would then toot something like [this](https://botsin.space/@pollski/202074), and you can boost it to your followers.

Note that you don't have to be the poll's creator in order to recommend it,
the poll can have several recommendation, and it's even OK if the
recommendation is biased.
For example, if you support a specific poll choice you can promote it like this:

```
@pollski@botsin.space recommend WhyChicken
Show them chickens we're not amused! vote "other"!!!
```
if people don't like it, they can create their own recommendations urging
their friends to vote for what they believe is best.

----

What if you have a reason to remove your recommendation (for example:
you've been told that your toot was incompatible with the server's code
of conduct)? Read on.

----

#### Untoot

If, for some reason you want to remove a recommendation of yours,
there are 3 ways to do it:

* The easiest is to reply to the recommendation with `untoot`
  (it's your decision whether you want to set the reply's visibility
  to `direct` or deliberately have this tiestamped and put
  on public record).
  
* You can copy the recommendation toot's url and toot
  `@pollski@botsin.space untoot https://botsin.space/users/pollski/updates/XXX`.
  
* You can simply toot `@pollski@botsin.space untoot XXX`
  (where `XXX` is the recommendation's id).
  
#### Destroy

`@pollski@botsin.space destroy MyRegretablePoll` would destroy a poll of yours.

### Code of Conduct

* Content of polls and recommendation should adhere to the
  [botsin.space CoC](https://botsin.space/about/more), especially the
  [Bots should punch up](https://www.crummy.com/2013/11/27/0)
  rule.

* If *anyone* manages to convince you should delete a poll or recommendation
  of yours, please be kind and `destroy`/`untoot` the
  offending poll/recommendation.
  
* If you believe the content of a poll or a recommendation is incompatible
  with the code of conduct, *pretty please* try to convince the author of the
  offending item to delete it (both polls and recommendations give credit
  to the author) before involving me.
  
* As a last resort, you can [contact me](https://thedod.github.io/#Contact),
  but pretty please try to resolve this between yourselves. I've added the
  `destroy` and `untoot` commands especially with such cases in mind.

### Privacy considerations

If you create a poll or recommend one, you get credited by the bot in related toots (without the `@` prefix, so that it wouldn't become a mastodon mention).

The bot does its best to keep private everything else: how you've voted, *whether* you've voted, or whether you've even *viewed* a poll.

It doesn't save the account names of voters (instead, it saves a keyed hash), but still — the bot's admin can login to Mastodon as the bot and view notifications (e.g. a vote) and outgoing direct statuses (e.g. confirmation of a vote). What the bot does in order to protect from accidental disclosures to a well meaning admin is:

* Notifications are removed as soon as they're processed
  (i.e. within 1-2 minutes).
* Outgoing direct statuses are removed after 24 hours
  (bot should give the recipients a reasonable amount of time to read them).
* All direct statuses have a content warning, so that a well meaning admin
  can avoid being accidentally exposed to the content of statuses during their
  24h "life span".

This is not perfect, but AFAIK it's way better than any known alternative out there.

## Create polls, vote, and be merry.

##### Comments and ideas are [welcome](https://thedod.github.io/#Contact).

----

<sup>[1]</sup> "Toot" is Mastodon's equivalent to Twitter's "tweet".

<sup>[2]</sup> If you want to open
a mastodon account and have no idea where, here's
[a handy directory](https://instances.mastodon.xyz/).