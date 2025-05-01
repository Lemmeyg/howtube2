type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogConfig {
  level: LogLevel
  enabled: boolean
  prefix?: string
}

const config: LogConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  enabled: process.env.NODE_ENV !== 'test',
  prefix: '[HowTube]'
}

export const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (message: string, ...args: any[]) => {
    if (config.enabled && ['debug'].includes(config.level)) {
      console.debug(`${config.prefix} ${message}`, ...args)
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message: string, ...args: any[]) => {
    if (config.enabled && ['debug', 'info'].includes(config.level)) {
      console.info(`${config.prefix} ${message}`, ...args)
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message: string, ...args: any[]) => {
    if (config.enabled && ['debug', 'info', 'warn'].includes(config.level)) {
      console.warn(`${config.prefix} ${message}`, ...args)
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message: string, ...args: any[]) => {
    if (config.enabled) {
      console.error(`${config.prefix} ${message}`, ...args)
    }
  }
} 