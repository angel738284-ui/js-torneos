import {normalizeSocialLink,renderSocialLinks} from "./profile-social.js";
import assert from "node:assert/strict";
const good=[
 ["@mi_cuenta","instagram","https://www.instagram.com/mi_cuenta/"],
 ["https://www.instagram.com/mi_cuenta/?hl=es","instagram","https://www.instagram.com/mi_cuenta/"],
 ["instagram.com/mi_cuenta","instagram","https://instagram.com/mi_cuenta"],
 ["@jsff","tiktok","https://www.tiktok.com/@jsff"],
 ["https://www.tiktok.com/@jsff?lang=es","tiktok","https://www.tiktok.com/@jsff"],
 ["https://vm.tiktok.com/ZM12345/","tiktok","https://vm.tiktok.com/ZM12345/"]
];
for(const [input,kind,expected] of good)assert.equal(normalizeSocialLink(input,kind),expected);
for(const [url,kind] of [
 ["javascript:alert(1)","instagram"],
 ["https://instagram.com.evil.test/steal","instagram"],
 ["https://www.tiktok.com.evil.test/@js","tiktok"],
 ["http://www.instagram.com/js","instagram"],
 ["https://www.instagram.com@evil.com/js","instagram"],
 ["https://www.instagram.com/","instagram"],
 ["https://tiktok.com/@js","instagram"]
])assert.throws(()=>normalizeSocialLink(url,kind));
assert.equal(normalizeSocialLink("","instagram"),null);
class FakeNode{
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.hidden=false;this.textContent=""}
 replaceChildren(...nodes){this.children=nodes}
 append(...nodes){this.children.push(...nodes)}
 setAttribute(k,v){this.attributes[k]=v}
}
globalThis.document={
 createElement:(tag)=>new FakeNode(tag),
 createElementNS:(ns,tag)=>new FakeNode(tag)
};
const container=new FakeNode("div");
renderSocialLinks(container,{instagram_url:"https://www.instagram.com/jsff/",tiktok_url:"https://www.tiktok.com/@jsff"});
assert.equal(container.children.length,2);
assert.equal(container.hidden,false);
for(const a of container.children){
 assert.equal(a.tag,"a");
 assert.equal(a.target,"_blank");
 assert.match(a.rel,/noopener/);
 assert.match(a.rel,/noreferrer/);
 assert.equal(a.referrerPolicy,"no-referrer");
 assert.equal(a.children[0].children[0].tag,"svg");
}
renderSocialLinks(container,{instagram_url:"javascript:alert(1)",tiktok_url:null});
assert.equal(container.children.length,0);
assert.equal(container.hidden,true);
console.log("SOCIAL_LINK_TESTS_OK",good.length,"valid links, 7 rejected links, SVG icons, external-link safety");
