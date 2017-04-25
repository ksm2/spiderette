#!/usr/bin/env node
'use strict';
const meow = require('meow');
const { Spiderette } = require('.');

const cli = meow(`
	Usage
	  $ spiderette <input>

	Options
	  -h, --help  Show this help text
`, {
  alias: {
    h: 'help'
  }
});

const spiderette = new Spiderette(cli.flags);
spiderette.runURL(cli.input[0]);
