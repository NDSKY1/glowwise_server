const bcrypt = require("bcryptjs");

/**
 * Password helpers.
 * Legacy Valida data stored plain-text passwords. New passwords are stored
 * as bcrypt hashes; old plain-text passwords still work once and are
 * upgraded to a hash on the next successful login (see `needsUpgrade`).
 */
const SALT_ROUNDS = 10;

const isHashed = (value) =>
  typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const hashPassword = (plain) => bcrypt.hashSync(String(plain), SALT_ROUNDS);

const verifyPassword = (plain, stored) => {
  if (stored === undefined || stored === null) return false;
  if (isHashed(stored)) return bcrypt.compareSync(String(plain), stored);
  return String(plain) === String(stored); // legacy plain-text
};

const needsUpgrade = (stored) => !isHashed(stored);

module.exports = { hashPassword, verifyPassword, needsUpgrade, isHashed };
