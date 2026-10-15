/* =====================================================================
   Fonds : l'épargne-actions de chaque ménage est versée chaque année dans un fonds
   (un par ménage, tiré au hasard). Les fonds financent les levées d'actions, puis reversent
   chaque année à leurs porteurs ce qu'ils ont reçu des entreprises.
   Avec gains interdits : un fonds ne récupère sur chaque entreprise que sa mise (plafond porté
   par les détenteurs), et chaque porteur ne récupère du fonds que ce qu'il y a versé (capF).
   ===================================================================== */
function makeFunds(C){
  const {N,P,prng,W,eqSave,fs,capInc}=C;const capped=C.world==='I',eps=1e-9;
  const NF=Math.max(1,Math.round(P.nfd||10)),M=Math.max(1,Math.round(P.m));
  const fundOf=new Int32Array(N);for(let i=0;i<N;i++)fundOf[i]=Math.min(NF-1,Math.floor(prng()*NF));
  // FC trésorerie, FU nombre de parts, FS valeur des participations (dernière évaluation), FI reçu dans l'année
  const FC=new Float64Array(NF),FU=new Float64Array(NF),FS=new Float64Array(NF),FI=new Float64Array(NF);
  const uF=new Float64Array(N),capF=new Float64Array(N);// parts détenues par chaque ménage, et sa mise restante
  let totFC=0;const syncFC=()=>{totFC=0;for(let f=0;f<NF;f++)totFC+=FC[f];};
  // prix d'une part : valeur du fonds / nombre de parts (au plus 1 avec gains interdits)
  // pcap : prix maximal d'une part avec gains interdits (1, revalorisé de l'inflation si la règle porte sur les gains réels)
  let pcap=1;const price=f=>{if(FU[f]<=eps)return 1;const p=(FC[f]+FS[f])/FU[f];return capped?Math.min(pcap,p):p;};
  return {NF,M,fundOf,income:FI,stake:FS,
    // versement de l'épargne-actions de l'année dans les fonds
    subscribe(){for(let i=0;i<N;i++){const q=eqSave[i];if(q<=eps)continue;const f=fundOf[i];let p=price(f);
        if(p<=1e-9){for(let j=0;j<N;j++)if(fundOf[j]===f)uF[j]=0;FU[f]=0;p=1;}// fonds ruiné : les anciennes parts ne valent plus rien
        const u=q/p;uF[i]+=u;FU[f]+=u;FC[f]+=q;capF[i]+=q;eqSave[i]=0;}syncFC();},
    // ce qu'un ménage peut retirer : sa part de la valeur, dans la limite de la trésorerie du fonds (et de sa mise restante avec gains interdits)
    available(i){const f=fundOf[i];if(FU[f]<=eps||uF[i]<=eps)return 0;let v=uF[i]*price(f);if(capped)v=Math.min(v,capF[i]);return Math.max(0,Math.min(v,FC[f]));},
    redeem(i,a){if(a<=eps)return;const f=fundOf[i];const p=price(f);const u=Math.min(uF[i],a/Math.max(p,1e-12));uF[i]-=u;FU[f]-=u;FC[f]-=a;totFC-=a;capF[i]=Math.max(0,capF[i]-a);},
    // capacité d'une levée : chaque fonds apporte au plus 1/M de sa trésorerie (règle de dispersion des OPCVM)
    capacity(){return Math.max(0,totFC/M);},
    // levée d'actions : tous les fonds au prorata ; renvoie les apports par fonds (identifiants de détenteur)
    raise(amount){const cap=this.capacity();const a=cap>eps?Math.min(1,amount/cap):0;const hi=[],hc=[];let got=0;
      for(let f=0;f<NF;f++){const c=a*FC[f]/M;if(c<=eps)continue;FC[f]-=c;totFC-=c;got+=c;hi.push(fundId(f));hc.push(c);}
      return {hi,hc,got};},
    // reversement aux porteurs de ce que les fonds ont reçu dans l'année
    payout(){let any=false;for(let f=0;f<NF;f++)if(FI[f]>eps)any=true;if(!any)return;
      const left=Float64Array.from(FI);for(let i=0;i<N;i++){const f=fundOf[i];if(FI[f]<=eps||uF[i]<=eps)continue;let x=FI[f]*uF[i]/FU[f];if(capped){x=Math.min(x,capF[i]);capF[i]-=x;}W[i]+=x;if(capInc)capInc[i]+=x;left[f]-=x;fs.fundPaid+=x;}
      for(let f=0;f<NF;f++){FC[f]+=Math.max(0,left[f]);FI[f]=0;}syncFC();},
    // monnaie détenue par les fonds (trésorerie et reçu de l'année pas encore reversé)
    // poche de liquidités : au-delà de `share` de la valeur du fonds, la trésorerie est rendue aux porteurs (rachat de parts)
    release(share){for(let f=0;f<NF;f++){const v=FC[f]+FS[f];const ex=FC[f]-share*v;if(ex<=eps||FU[f]<=eps)continue;const p=price(f);let paid=0;
        for(let i=0;i<N;i++){if(fundOf[i]!==f||uF[i]<=eps)continue;const x=ex*uF[i]/FU[f];const du=Math.min(uF[i],x/Math.max(p,1e-12));uF[i]-=du;capF[i]=Math.max(0,capF[i]-x);W[i]+=x;if(capInc)capInc[i]+=x;paid+=x;}
        let u=0;for(let i=0;i<N;i++)if(fundOf[i]===f)u+=uF[i];FU[f]=u;FC[f]-=paid;}syncFC();},
    // héritage : les parts d'un ménage passent à un autre ménage du même fonds
    move(i,j){if(fundOf[i]!==fundOf[j])return false;uF[j]+=uF[i];capF[j]+=capF[i];uF[i]=0;capF[i]=0;return true;},
    // parts reçues au départ en échange d'une partie du patrimoine (le fonds détient en contrepartie des parts d'entreprises existantes)
    seed(i,a){if(a<=eps)return;const f=fundOf[i];uF[i]+=a;FU[f]+=a;capF[i]+=a;},
    // gains interdits, règle réelle : mises restantes et prix maximal revalorisés de l'inflation (facteur g)
    index(g){pcap*=g;for(let i=0;i<N;i++)capF[i]*=g;},
    cash(){let s=0;for(let f=0;f<NF;f++)s+=FC[f]+FI[f];return s;},
    // valeur des parts de fonds de chaque ménage (après évaluation des participations dans FS) ; renvoie {total, unclaimed}
    value(eqv){const pr=new Float64Array(NF);let fv=0;for(let f=0;f<NF;f++){pr[f]=FU[f]>eps?(FC[f]+FS[f])/FU[f]:0;fv+=FC[f]+FS[f];}let claimed=0;
      for(let i=0;i<N;i++){if(uF[i]<=eps)continue;let v=uF[i]*pr[fundOf[i]];if(capped)v=Math.min(v,capF[i]);eqv[i]+=v;claimed+=v;}
      return {total:fv,unclaimed:Math.max(0,fv-claimed)};}};
}
