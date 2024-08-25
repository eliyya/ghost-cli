#!/usr/bin/env node
import { Command } from 'commander'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { confirm, input, password } from '@inquirer/prompts'
import fileSelector from '@eliyya/inquirer-fs-selector'
import chalk from 'chalk'
import { parse } from 'dotenv'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { Snowflake } from '@sapphire/snowflake'
import { hash } from 'bcrypt'
const snowflake = new Snowflake(
    new Date(process.env.NEXT_SNOWFLAKE_DATE ?? '2024-02-05'),
)

new Command()
    .name('ghost install')
    .description('Install the Ghost app in your system')
    .parse(process.argv)

const log = (message: string) => process.stdout.write(`${message}\n`)
const clearLastLine = () => {
    process.stdout.moveCursor(0, -1) // up one line
    process.stdout.clearLine(1) // from cursor to end
}
log('Installing Ghost app...')
log('Checking platform...')
if (!['win32', 'linux'].includes(process.platform)) {
    log(
        `Sorry, ${chalk.red(
            'Ghost app is only supported on Windows and Linux at the moment',
        )}`,
    )
    process.exit(1)
}
const platform = process.platform === 'win32' ? 'Windows' : 'Linux'
clearLastLine()
log(`Checking platform: ${chalk.cyan(`${platform} detected`)}`)
log('Checking system requirements...')
log('- Checking Node.js version...')
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 20 || (major === 20 && minor < 11)) {
    log(`Sorry, ${chalk.red('Ghost app requires Node.js v20.11.0 or higher')}`)
    process.exit(1)
}
clearLastLine()
log(
    `- Checking Node.js version: ${chalk.cyan(
        `Node.js ${process.versions.node} detected`,
    )}`,
)
log('- Checking git ...')
let gitVersion
try {
    gitVersion = execSync('git --version').toString().trim()
} catch (error) {
    log(`Sorry, ${chalk.red('Ghost app requires git to be installed')}`)
    log(
        `Please install git from ${
            platform === 'Windows'
                ? 'https://git-scm.com/download/win'
                : 'https://git-scm.com/download/linux'
        } and try again`,
    )
    process.exit(1)
}
clearLastLine()
log(`- Checking git: ${chalk.cyan(`git ${gitVersion} detected`)}`)
clearLastLine()
clearLastLine()
clearLastLine()
log(chalk.cyan('System requirements met'))
log(
    `- Checking Node.js version: ${chalk.cyan(
        `Node.js ${process.versions.node} detected`,
    )}`,
)
log(`- Checking git: ${chalk.cyan(`${gitVersion} detected`)}`)
const dirnameApp = platform === 'Windows' ? 'GhostApp' : '.ghostapp'
async function getInstalationPath(defaultPathToInstall: string) {
    const res = await confirm({
        message: `Installing Ghost app in ${defaultPathToInstall}`,
    })
    if (res) return defaultPathToInstall
    const filePath = await fileSelector({
        message: 'Select a dir:',
        path: dirname(defaultPathToInstall),
        dir: true,
    })
    return await getInstalationPath(join(filePath, dirnameApp))
}
const pathToInstall = await getInstalationPath(
    platform == 'Windows'
        ? join(process.env.ProgramFiles as string, dirnameApp)
        : '~/.ghostapp',
)
async function download() {
    try {
        execSync(`git clone https://github.com/eliyya/ghost "${pathToInstall}"`)
    } catch (error) {
        if (`${error}`.includes('Permission denied')) {
            log(
                `${chalk.red('Permission denied')}. Try running the command ${
                    platform === 'Windows' ? 'as administrator' : 'with sudo'
                }`,
            )
        } else if (`${error}`.includes('already exists')) {
            const res = await confirm({
                message: `Directory ${pathToInstall} already exists, do you want to overwrite it? (you will lose all data in the directory)`,
            })
            if (res) {
                await rm(pathToInstall, { recursive: true, force: true })
                await download()
            } else {
                log(chalk.red(`Directory ${pathToInstall} already exists`))
                process.exit(1)
            }
        } else {
            log(chalk.red('An error occurred while downloading Ghost app'))
            process.exit(1)
        }
    }
}
await download()
log(chalk.cyan('Ghost app downloaded successfully'))

log('Configuring Ghost app...')
const envText = await readFile(join(pathToInstall, 'example.env'), 'utf-8')
const env = parse(envText) as {
    [key: string]: string | undefined
    NEXT_JWT_SECRET: string | undefined
    GHOST_APP_DATA: string | undefined
    DB_PATH: string | undefined
}
env.NEXT_JWT_SECRET = Array(64)
    .fill(0)
    .map(() => Math.random().toString(36).charAt(2))
    .join('')
env.GHOST_APP_DATA =
    platform === 'Windows'
        ? join(process.env.APPDATA!, 'GhostApp')
        : join(process.env.HOME!, '.config', '.ghostapp')
env.DB_PATH = 'file:' + join(env.GHOST_APP_DATA, 'database.db')
await writeFile(
    join(pathToInstall, '.env'),
    Object.entries(env)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n'),
)
clearLastLine()
log('Configuring Ghost app...')

try {
    // create directory for data
    execSync(`mkdir ${env.GHOST_APP_DATA}`)
    // create directory for storage
    execSync(`mkdir ${join(env.GHOST_APP_DATA, 'storage')}`)
    execSync(`mkdir ${join(env.GHOST_APP_DATA, 'storage', 'tools')}`)
} catch (error) {
    if (`${error}`.includes('Permission denied')) {
        log(
            `${chalk.red('Permission denied')}. Try running the command ${
                platform === 'Windows' ? 'as administrator' : 'with sudo'
            }`,
        )
    } else if (`${error}`.includes('already exists')) {
        const res = await confirm({
            message: `Directory ${env.GHOST_APP_DATA} already exists, do you want to overwrite it? (you will lose all data in the directory)`,
        })
        if (res) {
            await rm(env.GHOST_APP_DATA, { recursive: true, force: true })
            // create directory for data
            execSync(`mkdir ${env.GHOST_APP_DATA}`)
            // create directory for storage
            execSync(`mkdir ${join(env.GHOST_APP_DATA, 'storage')}`)
            execSync(`mkdir ${join(env.GHOST_APP_DATA, 'storage', 'tools')}`)
        } else {
            log(chalk.red(`Directory ${env.GHOST_APP_DATA} already exists`))
            process.exit(1)
        }
    } else {
        log(chalk.red('An error occurred while downloading Ghost app'))
        process.exit(1)
    }
}

// install dependencies
log('Installing dependencies...')
execSync(`npm i`, {
    stdio: 'inherit',
    cwd: pathToInstall,
})
clearLastLine()
log(chalk.cyan('Dependencies installed successfully'))
log('Ghost app installed successfully')

log('Building GhostApp...')
execSync(`npx prisma migrate deploy`, {
    stdio: 'inherit',
    cwd: pathToInstall,
})
execSync(`npx prisma generate`, {
    stdio: 'inherit',
    cwd: pathToInstall,
})
execSync(`npm run build`, {
    stdio: 'inherit',
    cwd: pathToInstall,
})
clearLastLine()
log(chalk.cyan('GhostApp built successfully'))
const admin = await confirm({
    message: `Can you create an admin user for GhostApp?`,
})
if (admin) {
    const name = await getName()
    const username = await getUsername()
    const password = await getPassword()
    await cp(
        join(process.env.ProgramFiles as string, dirnameApp, 'prisma'),
        import.meta.resolve('../prisma').replace('file:///', ''),
        {
            recursive: true,
        },
    )
    execSync(`npx prisma generate`, {
        cwd: import.meta.resolve('..').replace('file:///', ''),
        stdio: 'inherit',
    })
    log('Creating admin user...')
    await import('@prisma/client').then(async ({ PrismaClient }) => {
        const prisma = new PrismaClient({
            datasourceUrl: env.DB_PATH,
        }) as any
        await prisma.user.create({
            data: {
                name: name,
                username: username,
                password: await hash(password, 10),
                admin: true,
                id: snowflake.generate().toString(),
            },
        })
    })
    await rm(
        join(import.meta.resolve('..').replace('file:///', ''), 'prisma'),
        {
            force: true,
            recursive: true,
        },
    )
}
async function getName() {
    const name = await input({
        message: 'Enter your admin name:',
    })
    if (!name) return await getName()
    const c = await confirm({
        message: `Your admin name is ${parseName(
            name,
            true,
        )}. Is that correct?`,
    })
    if (c) return parseName(name, true)
    else return await getName()
}
export function parseName(name: string, trim = true) {
    const n = trim ? name.trim() : name
    return n
        .replace(/ +/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
}
async function getUsername() {
    let username = await input({
        message: 'Enter your admin username: @',
    })
    username = username.trim().replace(/[@ \!\\\/]/g, '')
    if (!username) return await getUsername()
    const c = await confirm({
        message: `Your admin email is @${username}. Is that correct?`,
    })
    if (c) return username
    else return await getUsername()
}
async function getPassword() {
    let pass = await password({
        message: 'Enter your admin password:',
        mask: '*',
        validate: validatePassword,
    })
    if (!password) return await getPassword()
    const c = await password({
        message: `Enter your admin password again:`,
        mask: '*',
    })
    if (c === pass) return pass
    log(chalk.red('Passwords do not match'))
    return await getPassword()
}
function validatePassword(password: string) {
    if (!password.match(/[A-Z]/g))
        return 'La contrasenia debe tener al menos una mayuscula'
    if (!password.match(/[a-z]/g))
        return 'La contrasenia debe tener al menos una minuscula'
    if (!password.match(/[0-9]/g))
        return 'La contrasenia debe tener al menos un numero'
    if (!password.match(/[!?_\-+=*&%$#]/g))
        return 'La contrasenia debe tener al menos un caracter especial'
    if (password.length < 8)
        return 'La contrasenia debe tener al menos 8 caracteres'
    if (password.match(/[^A-Za-z0-9!?_\-+=*&%$#]/g))
        return 'La contrasenia solo puede tener los siguientes caracteres especiales: !?_-=+*&%$#'
    return true
}
log(chalk.green('GhostApp is ready to use'))
