/* eslint-disable no-undef */
import fs from 'fs';
import { resolve } from 'path';

const srcDir = resolve(__dirname, 'src');

const htmlFiles = fs
  .readdirSync(srcDir)
  .filter((file) => file.endsWith('.html') && file !== 'index.html');

export { htmlFiles };
