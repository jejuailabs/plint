const pnu='5011025333111050001';
for(const [name,path,params] of [
['characteristics','ned/data/getLandCharacteristics',{pnu,stdrYear:'2025',format:'json',numOfRows:'1'}],
['planning','ned/data/getLandUseAttr',{pnu,format:'json',numOfRows:'100'}],
['price','ned/data/getIndvdLandPriceAttr',{pnu,stdrYear:'2026',format:'json',numOfRows:'1'}],
['context','req/wfs',{service:'WFS',version:'1.1.0',request:'GetFeature',typeName:'lt_c_spbdbuilding',srsName:'EPSG:4326',output:'application/json',bbox:'126.3375,33.4662,126.3407,33.4690',maxFeatures:'80'}]
]){try{const url='https://api.vworld.kr/'+path+'?'+new URLSearchParams({...params,key:process.env.VWORLD_API_KEY,domain:process.env.VWORLD_DOMAIN||''});const r=await fetch(url,{signal:AbortSignal.timeout(12000)});const j=await r.json();console.log(JSON.stringify({name,data:name==='context'?{count:j.features?.length,first:j.features?.[0]?.properties,response:j.response}:j}));}catch(e){console.log(name,e.name)}}
