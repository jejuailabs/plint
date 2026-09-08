import { writeFileSync } from 'node:fs';
const results=[];
const safe=s=>{for(const name of ['VWORLD_API_KEY','DATA_GO_KR_API_KEY','JUSO_API_KEY','KMA_API_KEY']){const v=process.env[name];if(v)s=s.split(v).join('[redacted]');}return s.slice(0,260)};
async function get(name,url){try{const r=await fetch(url,{signal:AbortSignal.timeout(18000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{};results.push({name,status:r.status,type:r.headers.get('content-type'),sample:safe(text.slice(0,260))});return data;}catch(e){results.push({name,error:e.cause?.code||e.name});return null;}}
const vurl=(path,params)=>'https://api.vworld.kr/'+path+'?'+new URLSearchParams({...params,key:process.env.VWORLD_API_KEY||'',domain:process.env.VWORLD_DOMAIN||''});
const j=await get('address','https://business.juso.go.kr/addrlink/addrLinkApi.do?'+new URLSearchParams({confmKey:process.env.JUSO_API_KEY||'',keyword:'제주특별자치도 제주시 애월읍 애월해안로 255',resultType:'json',currentPage:'1',countPerPage:'1'}));
const a=j?.results?.juso?.[0];
if(a){const pnu=a.admCd+(a.mtYn==='1'?'2':'1')+a.lnbrMnnm.padStart(4,'0')+a.lnbrSlno.padStart(4,'0');results.push({pnu,address:a.jibunAddr});await Promise.all([
get('geocode',vurl('req/address',{service:'address',request:'getcoord',version:'2.0',crs:'EPSG:4326',type:'ROAD',address:a.roadAddr,format:'json'})),
get('price',vurl('ned/data/getIndvdLandPriceAttr',{pnu,stdrYear:'2025',format:'json',numOfRows:'1'})),
get('characteristics',vurl('ned/data/getLandCharacteristicsAttr',{pnu,stdrYear:'2025',format:'json',numOfRows:'1'})),
get('planning',vurl('ned/data/getLandUseAttr',{pnu,format:'json',numOfRows:'100'})),
get('boundary',vurl('req/wfs',{service:'WFS',version:'1.1.0',request:'GetFeature',typeName:'lt_c_landinfobasemap',srsName:'EPSG:4326',output:'application/json',filter:`<Filter><PropertyIsEqualTo><PropertyName>pnu</PropertyName><Literal>${pnu}</Literal></PropertyIsEqualTo></Filter>`,maxFeatures:'1'})),
get('transactions','https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade?'+new URLSearchParams({serviceKey:process.env.DATA_GO_KR_API_KEY||'',LAWD_CD:pnu.slice(0,5),DEAL_YMD:'202608',numOfRows:'1',pageNo:'1',_type:'json'})),
get('weather','https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList?'+new URLSearchParams({serviceKey:process.env.KMA_API_KEY||process.env.DATA_GO_KR_API_KEY||'',numOfRows:'1',pageNo:'1',dataType:'JSON',dataCd:'ASOS',dateCd:'DAY',startDt:'20250101',endDt:'20251231',stnIds:'184'}))]);}
console.log(JSON.stringify(results,null,2));
writeFileSync('docs/api-audit-2026-09-08.json',JSON.stringify(results,null,2));
