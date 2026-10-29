import assert from 'node:assert/strict';
import { getIpFromHeaders, getIpVersion } from '../apps/web/lib/ip.ts';
for (const [header, value, address, version] of [
  ['x-forwarded-for', '203.0.113.9, 10.6.0.101', '203.0.113.9', 4],
  ['x-forwarded-for', '2001:db8::9, 10.6.0.101', '2001:db8::9', 6],
  ['x-forwarded-for', '::ffff:203.0.113.9, 10.6.0.101', '203.0.113.9', 4],
  ['x-real-ip', '::FFFF:127.0.0.1', '127.0.0.1', 4],
  ['x-real-ip', '2001:db8:1234:5678:9abc:def0:1234:5678', '2001:db8:1234:5678:9abc:def0:1234:5678', 6],
] as const) {
  const ip = getIpFromHeaders(new Headers({ [header]: value }));
  assert.equal(ip, address);
  assert.equal(getIpVersion(ip), version);
  assert.equal(getIpVersion(value.split(',')[0]!), version);
}
console.log('PASS: IPv4, IPv6, proxy chain and IPv4-mapped socket normalization');
