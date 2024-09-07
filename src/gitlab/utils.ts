import fs from "fs"
import path from "path"
import ora from "ora"
import chalk from "chalk"
import { Repositories, RepositoryFiles, Groups } from "@gitbeaker/node"

const cwd = process.cwd()

let CONFIG_FILE = "fisand.json"
let GROUP_ID = ""
let REPO_ID: string | number = ""
let conf = {
  token: "",
  host: "",
}

async function getLocalConfig() {
  const fisandConfFile = path.join(cwd, CONFIG_FILE)
  if (fs.existsSync(fisandConfFile)) {
    const existConf = require(fisandConfFile)
    if (existConf.config) {
      const project_id = await getProjectId(existConf.config.workspace)
      REPO_ID = project_id || ""
      conf.token = existConf.config.token
      GROUP_ID = existConf.config.group_id
    }
  } else {
    console.log(
      chalk.red.bold(`${CONFIG_FILE} is not exist\nUse fisand workspace to init config`),
    )
    process.exit(1)
  }
}

function getLocalConfigSync() {
  const fisandConfFile = path.join(cwd, CONFIG_FILE)

  return fs.existsSync(fisandConfFile) ? require(fisandConfFile) : {}
}

async function downloadFisand(
  moduleName: string,
  dest: string,
  ref = "master",
) {
  const spinner = ora("Downloading...")
  spinner.start()

  const deps = await genFilesAndFolders(moduleName, dest, ref)

  spinner.succeed("Download success")

  return deps as Record<string, string>
}

async function genFilesAndFolders(
  moduleName: string,
  dest: string,
  ref: string,
) {
  const tree = await getRepoTree(moduleName)
  let deps = {}
  if (tree && tree.length) {
    for (const d of tree) {
      if (d.type === "tree") {
        fs.mkdirSync(`${dest}/${d.name}`, {
          recursive: true,
        })
        await genFilesAndFolders(
          `${moduleName}/${d.name}`,
          `${dest}/${d.name}`,
          ref,
        )
      } else if (d.type === "blob") {
        try {
          const excludes = getLocalConfigSync().excludes
          const ignore = (path: string) => excludes.includes(path)

          if (
            !excludes
              ? d.path.includes("tsconfig.json") ||
                d.path.includes("package.json")
              : ignore(path.basename(d.path))
          ) {
            if (d.path.includes("package.json")) {
              const content = await downloadFile(`${d.path}`, "", ref, false)
              deps = JSON.parse(content as string).fisand || {}
            } else {
              await Promise.resolve()
            }
          } else {
            await downloadFile(`${d.path}`, `${dest}/${d.name}`, ref)
          }
        } catch (error) {
          console.log(error)
        }
      }
    }
  }
  return deps
}

async function getRepoTree(path: string, ref = "master") {
  const repo = new Repositories(conf)
  const tree = await repo.tree(REPO_ID, {
    path: `packages/${path}`,
    ref,
  })
  return tree
}

async function downloadFile(
  filePath: string,
  dest: string,
  ref = "master",
  write = true,
) {
  const repoFile = new RepositoryFiles(conf)
  const { content } = await repoFile.show(REPO_ID, filePath, ref)

  return new Promise((resolve, reject) => {
    write
      ? fs.writeFile(dest, Buffer.from(content, "base64"), (error) => {
          if (!error) {
            resolve(true)
          } else {
            reject(error)
          }
        })
      : resolve(Buffer.from(content, "base64").toString("utf-8"))
  })
}

async function getModuleProjects() {
  if (!conf.token || !GROUP_ID) {
    throw Error("Please set your gitlab token and repo group")
  }
  const group = new Groups(conf)
  const projects = await group.projects(GROUP_ID)

  return projects
}

async function getProjectId(workspace: string) {
  const projects = await getModuleProjects()
  const project = projects.find((project) => project.name === workspace)

  return project?.id
}

async function checkFisandComp() {
  try {
    const spinner = ora("Loading...\n")
    spinner.start()
    await getLocalConfig()
    const tree = await getRepoTree("")
    spinner.succeed()
    return tree.filter((t) => t.type === "tree").map((t) => t.name)
  } catch (error) {
    process.exit(1)
  }
}

export {
  downloadFisand,
  getRepoTree,
  getModuleProjects,
  getLocalConfig,
  checkFisandComp,
}
