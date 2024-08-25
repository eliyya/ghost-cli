#!/usr/bin/env node
import { execSync } from 'child_process'
import { Command } from 'commander'
import 'dotenv/config'

new Command()
    .name('ghost start')
    .description('Start the Ghost app in your system')
    .parse(process.argv)
if (
    !process.env.GHOST_APP_DATA ||
    !process.env.DB_PATH ||
    !process.env.GHOST_PROGRAM_FILES
) {
    console.log('Please run `ghost install` first')
    process.exit(1)
}
console.log('Starting Ghost app...')
console.log('Do not close this terminal')
console.log('Press Ctrl+C to stop the app')
console.log()

execSync('npm start', {
    cwd: process.env.GHOST_PROGRAM_FILES,
    stdio: 'inherit',
})
