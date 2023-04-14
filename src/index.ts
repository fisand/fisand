import * as p from "@clack/prompts"
import color from "picocolors"
import { exec as exec_ } from "node:child_process"
import { promisify } from "node:util"
import tiged from "tiged"

const exec = promisify(exec_)

async function runCommand(cmd: string) {
  try {
    const { stdout, stderr } = await exec(cmd)
    console.log(stdout)
    console.error(stderr)
  } catch (err) {
    console.error(`Error: ${err}`)
  }
}

async function degitRepo(name: string, dest: string) {
  const emitter = tiged("github:fisand/" + name, {
    cache: false,
    force: true,
    verbose: true,
  })

  return emitter.clone(dest)
}

async function main() {
  console.clear()

  p.intro(`${color.bgCyan(color.black(" fisand "))}`)

  const project = await p.group(
    {
      type: ({ results }) =>
        p.select({
          message: `Pick a project template`,
          initialValue: "dapp",
          options: [
            { value: "vite-wagmi-starter", hint: "react" },
            { value: "webext-dapp-template", hint: "react" },
            { value: "vite-homepage-seed", hint: "vue" },
            { value: "astro-seed", hint: "todo" },
          ],
        }),
      path: () =>
        p.text({
          message: "Name your project",
          placeholder: "your-dapp",
          validate: (value) => {
            if (!value) return "Please enter a name."
          },
        }),
      install: () =>
        p.confirm({
          message: "Install dependencies?",
          initialValue: false,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.")
        process.exit(0)
      },
    },
  )

  if (project.type === 'astro-seed') {
    p.cancel('Astro-seed is still under development.')
    return
  }

  const s = p.spinner()
  s.start(`Download template ${project.type}`)
  await degitRepo(project.type as string, project.path)
  s.stop("Download complete")

  if (project.install) {
    const s = p.spinner()
    s.start("Installing via pnpm")
    await runCommand(`cd ./${project.path} && pnpm i`)
    s.stop("Installed via pnpm")
  }

  let nextSteps = `cd ${project.path}     \n${
    project.install ? "" : "pnpm install\n"
  }pnpm dev`

  p.note(nextSteps, "next:")

  p.outro(`${color.green("Success!")}`)
}

main().catch(console.error)
