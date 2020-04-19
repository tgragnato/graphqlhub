
require('dotenv/config');
require('babel-register');

const _graphql = require('graphql'),
  graphql = _graphql.graphql,
  GraphQLSchema = _graphql.GraphQLSchema;

const child = require('child_process'),
  crypto = require('crypto'),
  nedb = require('nedb');

const sha512 = (txt) => {
  return crypto.createHash('sha512').update(txt).digest('hex');
}

const defined = (check) => {
  if (!check) {
    usage();
    process.exit(1);
  }
}

const usage = function() {
  const usageText = `
  bridge connette nextcloud social con github, hacker news, reddit e twitter

  utilizzo:
    bridge <comando> [parametri]

    il comando può essere:

    github:        bridge github      <utente_github>    <nextcloud_account>
    hackernews:    bridge hackernews                     <nextcloud_account>
    reddit:        bridge reddit      <subreddit>        <nextcloud_account>
    twitter:       bridge twitter     <utente_twitter>   <nextcloud_account>
  `;

  console.log(usageText);
}

class Social {
  constructor (nextcloud_account) {
    this.account = nextcloud_account;
    this.data = new nedb({ filename: `./data.db`, autoload: true });
  }

  push(nota) {
    let json = { hash: sha512(nota), account: this.account };

    this.data.find(json, (e, found) => {
      if (!e && found.length == 0) this.data.insert(json, (e) => {

        if (e) throw e;
        let args = ['social:note:create', this.account, nota];

        console.log('occ', args);
        child.spawn('occ', args);
      });
    });
  }
}

var nc,user,nextcloud;

switch(process.argv[2]) {

  case 'reddit':
    subreddit = process.argv[3];
    nc = process.argv[4];
    defined(sub&&nc);

    nextcloud = new Social(nc);

    Reddit = require('./graphqlhub-schemas/src/reddit');

    schema = new GraphQLSchema({
      query: Reddit.QueryObjectType
    });

    query = `
      {
        subreddit(name: "${subreddit}") {
          topListings(limit: 5) {
            title
            url
            author {
              username
            }
          }
        }
      }`;

    graphql(schema, query).then((result) => {
      result.data.topListings.forEach((item) => {
        compose = `${item.title} @ ${item.url} by ${item.author.username}`;
        nextcloud.push(compose);
      });
    });

    break;

  case 'github':
    user = process.argv[3];
    nc = process.argv[4];
    defined(user&&nc);

    nextcloud = new Social(nc);

    Github = require('./graphqlhub-schemas/src/github');

    schema = new GraphQLSchema({
      query: Github.QueryObjectType
    });

    query = `
      {
        user(username:"${user}") {
          repos {
            name
            commits(limit:1) {
              ...commit
            }
          }
        }
      }

      fragment commit on GithubCommit {
        sha
        message
        author {
          ... on GithubUser {
            login
          }
        }
      }`;

    graphql(schema, query).then((result) => {
      result.data.user.repos.forEach((item) => {
        if (item.commits.author.login == user){
          compose = `New commit "${item.commits.sha}" in ${item.name} (${item.commits.message})"`;
          nextcloud.push(compose);
        }
      });
    });

    break;

  case 'twitter':
    user = process.argv[3];
    nc = process.argv[4];
    defined(user&&nc);

    nextcloud = new Social(nc);

    Twitter = require('./graphqlhub-schemas/src/twitter');

    schema = new GraphQLSchema({
      query: Twitter.QueryObjectType
    });

    query = `
      {
        user (identifier: name, identity: "${user}") {
          tweets {
            text
          }
        }
      }`;

    graphql(schema, query).then((result) => {
      result.data.user.tweets.forEach((item) => {
        nextcloud.push(text);
      });
    });

    break;

  case 'hackernews':
    nc = process.argv[3];
    defined(nc);

    nextcloud = new Social(nc);

    HackerNews = require('./graphqlhub-schemas/src/hn');

    schema = new GraphQLSchema({
      query: HackerNews.QueryObjectType
    });

    query = `
      {
        topStories {
          title
          url
          by {
            id
          }
        }
      }`;

    graphql(schema, query).then((result) => {
      result.data.topStories.forEach((item) => {
        compose = `${item.title} @ ${item.url} by ${item.by.id}`;
        nextcloud.push(compose);
      });
    });

    break;

  default:
    defined(null);
}
