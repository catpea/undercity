/**
 * command-line/parser.js — Client-side re-export of undercity-parser.
 *
 * The parser package is served as static files at /packages/parser/.
 * This module provides a convenient single import point for the IDE.
 *
 * Usage:
 *   import { parseCommand, resolveFlags, resolveArgs, T } from '/src/ide/command-line/parser.js';
 *   const { command, diagnostics } = parseCommand('scaffold form --name login');
 */

export {
  parse,
  parseCommand,
  parseArgsAndFlags,
  resolveFlags,
  resolveArgs,
  T,
  ParseError,
  Diagnostic,
} from '/packages/undercity-parser/index.js';
