#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command()
    .name('ghost')
    .description('A CLI tool for managing Ghost app')
    .command('install', 'Install the Ghost app in your system')
    .command('start', 'Start the Ghost app')    
    .command('update', 'Update the Ghost app')
    .command('restart', 'Restart the Ghost app')
    .command('stop', 'Stop the Ghost app')
    .command('uninstall', 'Uninstall the Ghost app from your system')
    .parse(process.argv)
