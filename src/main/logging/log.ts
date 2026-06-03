import log from 'electron-log/main.js';
import path from 'node:path';
import { getLogsDir } from '../storage/paths.js';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.transports.file.maxSize = 10 * 1024 * 1024;
log.transports.file.resolvePathFn = () => path.join(getLogsDir(), 'app.log');
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{scope}] {text}';
log.initialize();

export default log;