# changelog generator using greptile + octokit

the idea is to fetch diffs using octokit sdk and feed it to the greptile api to generate a changelog

currently has the following features:
- changelog based on releases
- changelog based on two commit hashes

works with any repo your github token has access to

could build it out as a cron job that adds changelogs on every release for a project
