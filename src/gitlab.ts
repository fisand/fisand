import yargs from "yargs"
import fs from "fs-extra"
import path from "path"
import chalk from "chalk"
import { prompt } from "enquirer"

import { getModuleProjects, downloadFisand, checkFisandComp } from "./utils"

const cwd = process.cwd()
let CONFIG_FILE = "fisand.json"
let root = path.join(cwd, "fisand-modules")

yargs
  .scriptName("fisand")
  .locale("en-US")
  .usage("$0 <command> [options]")
  .command(
    "list",
    chalk.bold.yellow("List all available sources"),
    checkFisandComp,
  )
  .command(
    "workspace [workspace]",
    "Init source repo",
    async (_) => {
      _.positional("workspace", {
        type: "string",
        describe: "Source repo",
      })
    },
    async (argv) => {
      let workspace = argv.workspace
      const projects = await getModuleProjects()
      const workspaces = projects.map((project) => {
        return {
          name: project.name,
          message: `${project.name}(${project.description})`,
        }
      })
      const isWorkspaceValid =
        workspace && workspaces.find((project) => project.name === workspace)

      if (!isWorkspaceValid) {
        workspace && console.log(chalk.red.bold(`${workspace} is not exist\n`))

        if (!workspace) {
          const { project } = await prompt<{
            project: string
          }>({
            type: "select",
            name: "project",
            message: "Please Select",
            choices: workspaces,
          })
          workspace = project
        }
      }
      // make fisand.json
      const fisandConfFile = path.join(cwd, CONFIG_FILE)
      const confTemplate = {
        config: {
          workspace,
        },
      }

      fs.writeFileSync(fisandConfFile, JSON.stringify(confTemplate, null, 2))

      console.log(chalk.green(`Init ${CONFIG_FILE} success`))
    },
  )
  .command(
    "import [-d] [-r] <name..>",
    "Import source code",
    async (_) => {
      _.positional("name", {
        type: "string",
        describe: "Source name",
      })
      _.positional("directory", {
        type: "string",
        describe: "Download path",
        alias: "d",
      })
      _.positional("ref", {
        type: "string",
        describe: "Source version: branch/commit/tag",
        alias: "r",
        default: "master",
      })
    },
    async (
      argv: yargs.ArgumentsCamelCase<{
        name: string[]
        r?: string
        ref?: string
        d?: string
        directory: string
      }>,
    ) => {
      const fisandComps = await checkFisandComp()
      argv.name.forEach((n) => {
        if (!fisandComps.includes(n)) {
          console.log(
            chalk.red.bold(`${n} is not exist\nUse fisand list to check`),
          )
          process.exit(1)
        }
      })

      // The name of branch, tag or commit
      let ref = argv.r || argv.ref || "master"
      const fisandConfFile = path.join(cwd, CONFIG_FILE)
      const confTemplate: Record<string, any> = {}
      if (!fs.existsSync(fisandConfFile)) {
        argv.name.forEach((n) => (confTemplate[n] = ref))
        fs.writeFileSync(fisandConfFile, JSON.stringify(confTemplate, null, 2))
      } else {
        const existConf = require(fisandConfFile)
        if (existConf && existConf.config && existConf.config.workspace) {
          root = path.join(cwd, existConf.config.workspace)
        }
        // get workspace
        argv.name.forEach((n) => {
          if (typeof existConf[n] === "string") {
            ref = existConf[n]
          } else {
            existConf[n] = ref
            fs.writeFileSync(fisandConfFile, JSON.stringify(existConf, null, 2))
          }
        })
      }

      const notBoolean = (...b: unknown[]) =>
        b.every((_) => typeof _ !== "boolean")
      // dest
      if ((argv.d || argv.directory) && notBoolean(argv.d, argv.directory)) {
        root = path.join(cwd, argv.d || argv.directory)
      }

      // order -d > fisand.json workspace > fisand-modules
      console.log(chalk.green(`Download source to ${root}`))

      if (!fs.existsSync(root)) {
        fs.mkdirSync(`${root}`, { recursive: true })
      }

      for (const i of argv.name.map((n) =>
        downloadFisand(n, notBoolean(ref) ? ref : "master"),
      )) {
        // download source
        const depMap = await i

        // search deps
        const deps = Object.keys(depMap)
        const workspace = (require(fisandConfFile).config || {}).workspace || ""
        if (workspace) {
          for (const dep of deps) {
            if (dep.startsWith(workspace)) {
              const name = dep.replace(`${workspace}/`, "")
              // check deps then download
              if (!fs.existsSync(`${root}/${name}`)) {
                await downloadFisand(name, (depMap[dep] as string) || "master")
              }
            }
          }
        }
      }

      process.exit(0)
    },
  )
  .example("$0 list", chalk.bold.greenBright("List all available sources"))
  .help()
  .alias("help", "h")
  .version()
  .alias("version", "v").argv
