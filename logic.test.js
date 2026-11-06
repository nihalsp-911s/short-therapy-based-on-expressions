import {test} from 'node:test';import assert from 'node:assert/strict';import {matchFace,validPeople,messages} from './logic.js';
test('unrecognized people remain unknown',()=>assert.equal(matchFace([1,1],[{name:'A',descriptor:[0,0]}]),null));
test('closest face below threshold matches',()=>assert.equal(matchFace([.1,.1],[{name:'A',descriptor:[0,0]},{name:'B',descriptor:[.2,.3]}]).name,'A'));
test('malformed saved templates are rejected',()=>assert.deepEqual(validPeople([{name:'x',descriptor:[1]},null]),[]));
test('all seven expressions have support text',()=>assert.equal(Object.keys(messages).length,7));
