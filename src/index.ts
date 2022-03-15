import yargs from "yargs"
import fs from "fs-extra"
import path from "path"
import chalk from "chalk"
import ora from "ora"
import { prompt } from "enquirer"

yargs
  .scriptName("fisand")
  .locale("en-US")
  .usage("$0 <command> [options]")
  .command('list', chalk.bold.yellow('list all available sources'), async (yargs) => {
    const response = await prompt({
      type: 'input',
      name: 'name',
      message: 'Who is the most beautiful person in the world?'
    });
    
    console.log(response);
  })
  .example("$0 list", chalk.bold.greenBright('list all available sources'))
  .help()
  .alias("help", "h")
  .version()
  .alias("version", "v").argv
