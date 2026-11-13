import { same } from './module.mjs';
import * as path from 'node:path';

export const joined = path.join(String(same), 'x');
