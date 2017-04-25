#!/usr/bin/env node
'use strict';
const meow = require('meow');
const { Spiderette } = require('.');

const cli = meow(`
	Usage
	  $ spiderette <input>

	Options
	  -i, --internal         Check only internal references
	  -R, --ignore-redirect  Don't display redirects
	  -C, --ignore-client    Don't display client errors
	  -S, --ignore-server    Don't display server errors
	  -v, --verbose          Log all requests
	  -h, --help             Show this help text
	  -V, --version          Display the version
`, {
  alias: {
    i: 'internal',
    R: 'ignoreRedirect',
    C: 'ignoreClient',
    S: 'ignoreServer',
    v: 'verbose',
    h: 'help',
    V: 'version'
  },
  boolean: ['internal', 'verbose', 'ignoreRedirect', 'ignoreClient']
});

const spiderette = new Spiderette(cli.flags);
spiderette.runURL(cli.input[0]);
