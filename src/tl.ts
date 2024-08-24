import { release } from 'node:os';

// This function 'supportsColor' was copied from a project under the MIT license.
// https://github.com/chalk/supports-color/blob/c5edf46896d1fc1826cb1183a60d61eecb65d749/index.js
function supportsColor(haveStream: boolean, streamIsTTY: boolean) {
    let forceColor = 0;
    if (hasFlag('no-color') ||
        hasFlag('no-colors') ||
        hasFlag('color=false') ||
        hasFlag('color=never')) {
        forceColor = 0;
    } else if (hasFlag('color') ||
        hasFlag('colors') ||
        hasFlag('color=true') ||
        hasFlag('color=always')) {
        forceColor = 1;
    }

    if ('FORCE_COLOR' in process.env) {
        if (process.env.FORCE_COLOR === 'true') {
            forceColor = 1;
        } else if (process.env.FORCE_COLOR === 'false') {
            forceColor = 0;
        } else {
            forceColor = process.env.FORCE_COLOR!.length === 0 ? 1 : Math.min(parseInt(process.env.FORCE_COLOR!, 10), 3);
        }
    }

	if (forceColor === 0) return 0

	if (hasFlag('color=16m') ||
		hasFlag('color=full') ||
		hasFlag('color=truecolor')) {
		return 3;
	}

	if (hasFlag('color=256')) return 2

	if (haveStream && !streamIsTTY && forceColor === undefined) return 0

	const min = forceColor || 0;

	if (process.env.TERM === 'dumb') return min

	if (process.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = release().split('.');
		if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) return Number(osRelease[2]) >= 14931 ? 3 : 2;
		

		return 1;
	}

	if ('CI' in process.env) {
		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(sign => sign in process.env) || process.env.CI_NAME === 'codeship') return 1

		return min;
	}

	if ('TEAMCITY_VERSION' in process.env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(process.env.TEAMCITY_VERSION!) ? 1 : 0;
	}

	if (process.env.COLORTERM === 'truecolor') return 3
	

	if ('TERM_PROGRAM' in process.env) {
		const version = parseInt((process.env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (process.env.TERM_PROGRAM) {
			case 'iTerm.app':
				return version >= 3 ? 3 : 2;
			case 'Apple_Terminal':
				return 2;
			// No default
		}
	}

	if (/-256(color)?$/i.test(process.env.TERM!)) return 2

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(process.env.TERM!)) return 1

	if ('COLORTERM' in process.env) return 1

	return min
}


// This function 'hasFlag' was copied from a project under the MIT license.
// https://github.com/sindresorhus/has-flag
function hasFlag(flag: string, argv = process.argv) {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}

// Functions 'parseVersion' and 'supportsHyperlink' was copied from a project under the MIT license.
// https://github.com/jamestalmage/supports-hyperlinks
function parseVersion(versionString: string) {
    if (/^\d{3,4}$/.test(versionString)) {
        // Env var doesn't always use dots. example: 4601 => 46.1.0
        const m = /(\d{1,2})(\d{2})/.exec(versionString) || [];
        return {
            major: 0,
            minor: parseInt(m[1], 10),
            patch: parseInt(m[2], 10)
        };
    }

    const versions = (versionString || '').split('.').map(n => parseInt(n, 10));
    return {
        major: versions[0],
        minor: versions[1],
        patch: versions[2]
    };
}
function supportsHyperlink(stream: { isTTY?: boolean | undefined }) {
    const {
        CI,
        FORCE_HYPERLINK,
        NETLIFY,
        TEAMCITY_VERSION,
        TERM_PROGRAM,
        TERM_PROGRAM_VERSION,
        VTE_VERSION
    } = process.env;

    if (FORCE_HYPERLINK) {
        return !(FORCE_HYPERLINK.length > 0 && parseInt(FORCE_HYPERLINK, 10) === 0);
    }

    if (hasFlag('no-hyperlink') || hasFlag('no-hyperlinks') || hasFlag('hyperlink=false') || hasFlag('hyperlink=never')) {
        return false;
    }

    if (hasFlag('hyperlink=true') || hasFlag('hyperlink=always')) {
        return true;
    }

    // Netlify does not run a TTY, it does not need `supportsColor` check
    if (NETLIFY) return true

    // If they specify no colors, they probably don't want hyperlinks.
    if (!supportsColor(true, true)) return false

    if (stream && !stream.isTTY) return false

    // Windows Terminal
    if ('WT_SESSION' in process.env) {
        return true;
    }

    if (process.platform === 'win32') {
        return false;
    }

    if (CI) {
        return false;
    }

    if (TEAMCITY_VERSION) {
        return false;
    }

    if (TERM_PROGRAM) {
        const version = parseVersion(TERM_PROGRAM_VERSION || '');

        switch (TERM_PROGRAM) {
            case 'iTerm.app':
                if (version.major === 3) {
                    return version.minor >= 1;
                }

                return version.major > 3;
            case 'WezTerm':
                return version.major >= 20200620;
            case 'vscode':
                // eslint-disable-next-line no-mixed-operators
                return version.major > 1 || version.major === 1 && version.minor >= 72;
            // No default
        }
    }

    if (VTE_VERSION) {
        // 0.50.0 was supposed to support hyperlinks, but throws a segfault
        if (VTE_VERSION === '0.50.0') {
            return false;
        }

        const version = parseVersion(VTE_VERSION);
        return version.major > 0 || version.minor >= 50;
    }

    return false;
}

export function terminalLink(
    {
        text,
        url,
        target = 'stdout',
        fallback = (text: string, url: string) => `${text} (\u200B${url}\u200B)`
    }: {
        fallback?: ((text: string, url: string) => string) | boolean;
        target?: 'stdout' | 'stderr';
        text: string;
        url: string;
    }) {
    const stream = target === 'stdout' ? process.stdout : process.stderr
    if (supportsHyperlink(stream)) return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`
    if (fallback === false) return text
    if (typeof fallback === 'function') return fallback(text, url)
    return `${text} (\u200B${url}\u200B)`
}