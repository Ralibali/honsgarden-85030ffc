// These tests need no Apple credentials and never grant access.
// deno run --node-modules-dir=none --allow-env supabase/tests/apple-jws.mjs
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {createAppleVerifiers, AppleConfigurationError} from '../functions/_shared/appleJws.ts';
assert.throws(()=>createAppleVerifiers(0,false),AppleConfigurationError);
assert.equal(createAppleVerifiers(6809292574,false).length,1);
assert.equal(createAppleVerifiers(6809292574,true).length,2);
const transaction = {bundleId:'se.honsgarden.app',productId:'se.honsgarden.plus.yearly',originalTransactionId:'forged',transactionId:'forged',environment:'Production',expiresDate:Date.now()+86400000};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
for (const verifier of createAppleVerifiers(6809292574,true)) {
  await assert.rejects(()=>verifier.verifyAndDecodeTransaction(`${encode({alg:'none'})}.${encode(transaction)}.`));
  await assert.rejects(()=>verifier.verifyAndDecodeTransaction(`${encode({alg:'ES256',x5c:['forged-certificate']})}.${encode(transaction)}.AAAA`));
  await assert.rejects(()=>verifier.verifyAndDecodeNotification(`${encode({alg:'none'})}.${encode({notificationType:'SUBSCRIBED',data:{bundleId:'se.honsgarden.app',appAppleId:6809292574,environment:'Production'}})}.`));
}
console.log('PASS: required app configuration; unsigned transactions, untrusted certificates and unsigned notifications rejected in production and sandbox');
