/* VWorld WebGL 3 is isolated because its SDK owns the Cesium global. */
(() => {
  const notice = document.getElementById('notice');
  const send = (value) => parent.postMessage({channel:'plint-vworld',...value},location.origin);
  let viewer, config, generation=0, started=false;
  const fail = (message) => {notice.textContent=message;send({type:'error',message});};
  const timeout=setTimeout(()=>fail('VWorld 3D 연결 시간 초과: API 도메인 등록 및 WebGL 지원을 확인해 주세요.'),30000);
  async function draw(data) {
    const current=++generation;
    config=data;
    if(!viewer)return;
    const C=window.Cesium;
    viewer.entities.removeAll();
    const p=data.scenario.massing;
    let ground=0;
    try {
      const positions=await C.sampleTerrainMostDetailed(viewer.terrainProvider,[C.Cartographic.fromDegrees(data.center.longitude,data.center.latitude)]);
      ground=Number.isFinite(positions[0].height)?positions[0].height:0;
    }catch{/* Elevation remains explicitly unverified. */}
    if(current!==generation)return;
    if(data.boundary) viewer.entities.add({name:'대상 필지 경계',polygon:{hierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(data.boundary.coordinates[0].flat()),data.boundary.coordinates.slice(1).map(r=>new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(r.flat())))),material:C.Color.YELLOW.withAlpha(0.12),outline:true,outlineColor:C.Color.YELLOW}});
    if(p){let height=ground;const area=p.widthM*p.depthM;
      data.scenario.floors.forEach((floor,i)=>{const scale=Math.sqrt((p.floorAreasSqm[i]||0)/area);if(!scale)return;
        const ring=p.footprint.coordinates[0].map(([lon,lat])=>[p.center.longitude+(lon-p.center.longitude)*scale,p.center.latitude+(lat-p.center.latitude)*scale]);
        viewer.entities.add({name:floor.floor+'F 제안 매스',polygon:{hierarchy:C.Cartesian3.fromDegreesArray(ring.flat()),height,extrudedHeight:height+floor.heightM,material:C.Color.fromCssColorString('#bff7ff').withAlpha(0.9),outline:true,outlineColor:C.Color.CYAN}});height+=floor.heightM;
      });
    }
    const target=C.Cartesian3.fromDegrees(data.center.longitude,data.center.latitude,ground);
    viewer.camera.lookAt(target,new C.HeadingPitchRange(C.Math.toRadians(330),C.Math.toRadians(-40),280));
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
    viewer.scene.requestRender();
    notice.textContent='VWorld 3D · 제안 매스는 규제 미검증 · 배경 기존 건물은 현황 자료';
    send({type:'ready'});
  }
  addEventListener('message', async(event)=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.channel!=='plint-vworld')return;
    const message=event.data;
    if(message.type==='config'){if(!started)initialize(message.data);else await draw(message.data);return;}
    if(message.type==='focus'&&config&&viewer){await draw(config);return;}
    if(message.type==='capture'&&viewer){
      try {
        const started=Date.now();
        while(!viewer.scene.globe.tilesLoaded && Date.now()-started<15000){viewer.scene.requestRender();await new Promise(r=>setTimeout(r,200));}
        if(!viewer.scene.globe.tilesLoaded)throw new Error('VWorld 영상 로딩 중입니다. 잠시 후 다시 캡처해 주세요.');
        viewer.render();
        const source=viewer.scene.canvas, canvas=document.createElement('canvas');
        const scale=Math.min(1,960/source.width,640/source.height),height=Math.round(source.height*scale);
        canvas.width=Math.round(source.width*scale);
        const ctx=canvas.getContext('2d');ctx.font='14px sans-serif';
        const caption='공간정보 오픈플랫폼 VWorld 3D · Cesium · '+config.address+' · '+config.scenario.name+' · 제안 매스 / 규제 미검증 · '+new Date().toLocaleDateString('ko-KR');
        const lines=[];let line='';for(const char of caption){if(ctx.measureText(line+char).width>canvas.width-24&&line){lines.push(line);line=char;}else line+=char;}if(line)lines.push(line);
        canvas.height=height+lines.length*20+20;ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,height);ctx.fillStyle='#172b3c';ctx.font='14px sans-serif';lines.forEach((text,i)=>ctx.fillText(text,12,height+20+i*20));
        send({type:'capture',id:message.id,image:canvas.toDataURL('image/png')});
      }catch(error){send({type:'capture',id:message.id,error:error.message||'화면 캡처 실패'});}
    }
  });
  function initialize(data){
  started=true;config=data;
  try {
    if(!window.vw)throw new Error('VWorld SDK를 불러오지 못했습니다. API 도메인 및 네트워크를 확인해 주세요.');
    const map=new vw.Map();map.setOption({mapId:'map',logo:true,navigation:true});map.setMapId('map');
    vw.ws3dInitCallBack=()=>{clearTimeout(timeout);viewer=window.ws3d?.viewer;if(!viewer){fail('VWorld 뷰어 초기화 실패');return;}if(config)void draw(config);send({type:'initialized'});};
    map.setInitPosition(new vw.CameraPosition(new vw.CoordZ(data.center.longitude,data.center.latitude,400),new vw.Direction(330,-40,0)));
    map.start();
  }catch(error){clearTimeout(timeout);fail(error.message);}
  }
  send({type:'initialized'});
})();
