# Génère les trois planches techniques (SVG) et les injecte dans index.html
import re
from tr import T as TR

def EN(k): return TR[k][0]
# correspondance texte francais d'origine -> cle, pour les textes a l'interieur des dessins
SVG_KEYS = {
 'Éthanol': ['pl1.eth', 'pl3.eth'], 'Oxygène gazeux': ['pl1.gox', 'pl1.gox2'],
 'Détail A, agrandi': ['pl1.detail'], "Sortie de l'injecteur coaxial": ['pl1.coax'],
 'Pression': ['pl1.press'], 'Nombre de Mach': ['pl1.mach'], 'M = 1 au col': ['pl1.m1'],
 'Injecteur': ['pl1.inj'], 'Convergent': ['pl1.conv'], 'Col': ['pl1.throat'], 'Sortie': ['pl1.exit'],
 'Évolution le long': ['pl1.along1'], "de l'axe (allure)": ['pl1.along2'],
 'Vue 1, partie avant': ['pl2.v1'], 'Vue 2, partie arrière': ['pl2.v2'],
 'Fusée à ergols liquides': ['pl2.title'], 'Coupe longitudinale': ['pl2.cut'],
 'Planche 2 / 3': ['pl2.plate'], 'Sans échelle': ['pl2.scale'], 'Sens du vol': ['pl2.flight'],
 'Coupe B-B': ['pl2.bb'], 'Section au niveau des ailerons': ['pl2.bbsub'], 'Marge statique': ['pl2.marge'],
 'Purge azote': ['pl3.purge'], "Banc d'essai": ['pl3.bench'],
 'Poste de commande': ['pl3.cmd'], "à distance, opérateurs à l'abri": ['pl3.cmd2'],
 'Séquenceur de mise à feu': ['pl3.seq'], "compte à rebours, arrêt d'urgence": ['pl3.seq2'],
 'Acquisition de données': ['pl3.daq'], 'pression, poussée, température': ['pl3.daq2'],
}
LEFT = {k: list(v) for k, v in SVG_KEYS.items()}
def localize(html):
    """Passe les textes des dessins en anglais et leur pose la cle de traduction."""
    left = LEFT
    def sub(m):
        head, txt = m.group(1), m.group(2)
        if txt not in left: return m.group(0)
        keys = left[txt]
        assert keys, 'trop d%soccurrences de %s' % (chr(39), txt)
        k = keys.pop(0)
        return head + ' data-t="' + k + '">' + EN(k) + '</text>'
    out = re.sub(r'(<text[^>]*?)>([^<>]*)</text>', sub, html)
    for m in re.finditer(r'<text((?:(?!data-t=)[^<>])*)>([^<>]*)</text>', out):
        t = m.group(2)
        assert not re.search(r'[a-zà-ÿ]{4}', t), 'texte non traduit : ' + t
    return out
ETH='#E8B86A'; GOX='#6FB6FF'; RED='#e1251b'
def bal(n,x,y,tx,ty):
    import math
    dx,dy=tx-x,ty-y; L=math.hypot(dx,dy) or 1
    sx,sy=x+dx/L*10,y+dy/L*10
    return f'<g class="b" data-n="{n}"><path class="thin" d="M{sx:.1f} {sy:.1f}L{tx} {ty}"/><circle class="dot" cx="{tx}" cy="{ty}" r="1.8"/><circle class="halo" cx="{x}" cy="{y}" r="10"/><circle class="bal" cx="{x}" cy="{y}" r="10"/><text class="bn" x="{x}" y="{y+3.6:.1f}" text-anchor="middle">{n}</text></g>'
def arrow(x1,y1,x2,y2,col,w=1.6):
    import math
    a=math.atan2(y2-y1,x2-x1); h=7
    p1=(x2-h*math.cos(a-0.45),y2-h*math.sin(a-0.45)); p2=(x2-h*math.cos(a+0.45),y2-h*math.sin(a+0.45))
    return f'<path d="M{x1} {y1}L{x2} {y2}M{p1[0]:.1f} {p1[1]:.1f}L{x2} {y2}L{p2[0]:.1f} {p2[1]:.1f}" stroke="{col}" stroke-width="{w}"/>'
def dim_h(x1,x2,y,label,ly=None):
    return (f'<path class="thin" d="M{x1} {y}H{x2}M{x1} {y-5}V{y+5}M{x2} {y-5}V{y+5}M{x1} {y}l7 -3M{x1} {y}l7 3M{x2} {y}l-7 -3M{x2} {y}l-7 3"/>'
            f'<text class="it" x="{(x1+x2)/2}" y="{(ly or y)-6}" text-anchor="middle">{label}</text>')
def dim_v(x,y1,y2,label,side=1):
    return (f'<path class="thin" d="M{x} {y1}V{y2}M{x-5} {y1}H{x+5}M{x-5} {y2}H{x+5}M{x} {y1}l-3 7M{x} {y1}l3 7M{x} {y2}l-3 -7M{x} {y2}l3 -7"/>'
            f'<text class="it" x="{x+8*side}" y="{(y1+y2)/2+4}" text-anchor="{"start" if side>0 else "end"}">{label}</text>')

# ---------------------------------------------------------------- PLANCHE 1 : coupe du moteur
def plate1():
    S=4; Y0=215
    X=lambda x:240+S*x; Y=lambda r:Y0-S*r
    HB=[[0,40],[14.4,40],[14.4,12.5],[10,12.5],[10,1.75],[30,1.75],[30,0.85],[0,0.85]]
    HF=[[20.4,40],[30,40],[30,3.15],[25,3.15],[25,12.5],[20.4,12.5]]
    CU=[[30,30],[178,30],[178,10],[168,7.5],[145,21],[30,21]]
    def poly(P,s): return 'M'+'L'.join(f'{X(x):.1f} {Y(r*s):.1f}' for x,r in P)+'Z'
    o=['<defs><pattern id="h-steel" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#f2f2f0" stroke-width="1" opacity=".3"/></pattern>'
       '<pattern id="h-cu" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#D08A5E" stroke-width="1.1" opacity=".55"/></pattern>'
       '<clipPath id="clipA"><circle cx="1095" cy="185" r="88"/></clipPath></defs>']
    # hachures (fondu) puis contours (tracés)
    o.append('<g class="f">'+''.join(f'<path fill="url(#h-steel)" stroke="none" d="{poly(P,s)}"/>' for P in (HB,HF) for s in (1,-1))+''.join(f'<path fill="url(#h-cu)" stroke="none" d="{poly(CU,s)}"/>' for s in (1,-1))+'</g>')
    for P in (HB,HF,CU):
        for s in (1,-1): o.append(f'<path class="d{" cu" if P is CU else ""}" pathLength="1" d="{poly(P,s)}"/>')
    g=[]
    g.append(f'<path class="axis" d="M{X(-34)} {Y0}H{X(196)}"/>')
    # collecteur et orifices du film de refroidissement
    for s in (1,-1):
        y1,y2=sorted((Y(18.2*s),Y(21.6*s)))
        g.append(f'<rect class="hid" x="{X(22.4):.1f}" y="{y1:.1f}" width="{3.8*S:.1f}" height="{y2-y1:.1f}"/>')
        g.append(f'<path d="M{X(24.2):.1f} {Y(19.9*s):.1f}H{X(30)}" stroke="#F6E3B8" stroke-width="2"/>')
    # écoulements
    g.append(arrow(X(-32),Y0,X(-3),Y0,ETH,2))
    g.append(arrow(X(17.4),Y(51),X(17.4),Y(42),GOX,2)); g.append(arrow(X(17.4),Y(-51),X(17.4),Y(-42),GOX,2))
    g.append(arrow(X(17.4),Y(34),X(17.4),Y(18),GOX,1.3)); g.append(arrow(X(17.4),Y(-34),X(17.4),Y(-18),GOX,1.3))
    g.append(f'<text x="{X(-33)}" y="{Y0-10}" fill="{ETH}">Éthanol</text><text x="{X(17.4)+12}" y="{Y(46)}" fill="{GOX}">Oxygène gazeux</text><text x="{X(17.4)+12}" y="{Y(-46)+30}" fill="{GOX}">Oxygène gazeux</text>')
    # cotes symboliques (les valeurs ne sont pas publiées)
    g.append(f'<path class="thin" d="M{X(30)} {Y(-30)+4}V{Y(-30)+28}M{X(145)} {Y(-21)+4}V{Y(-30)+28}"/>'+dim_h(X(30),X(145),Y(-30)+22,'L<tspan class="sub" dy="3">c</tspan>'))
    g.append(dim_v(X(62),Y(21),Y(-21),'Ø D<tspan class="sub" dy="3">c</tspan>'))
    g.append(f'<path class="thin" d="M{X(178)+3} {Y(10)}H{X(178)+30}M{X(178)+3} {Y(-10)}H{X(178)+30}"/>'+dim_v(X(178)+24,Y(10),Y(-10),'Ø D<tspan class="sub" dy="3">e</tspan>'))
    g.append(f'<path class="thin" d="M{X(168)} {Y(7.5)}V{Y(-7.5)}"/><path class="thin" d="M{X(168)} {Y(-7.5)}L{X(160)} {Y(-13)}"/><text class="it" x="{X(160)-4}" y="{Y(-13)+10}" text-anchor="end">Ø D<tspan class="sub" dy="3">t</tspan></text>')
    # repères
    B=[(1,X(-24),Y0+30,X(-10),Y0),(2,X(4),28,X(15.5),Y(40)+6),(3,X(58),28,X(27),Y(30)),(4,X(88),66,X(88),Y(10)),(5,X(150),66,X(156),Y(13)),(6,X(169),66,X(168),Y(7.5)),(7,X(188),66,X(174),Y(8.6)),
       (8,X(2),404,X(20),Y(-1.3)),(9,X(27),404,X(28),Y(-2.45)),(10,X(41),404,X(27.5),Y(-19.9)),(11,X(120),404,X(110),Y(-25.5))]
    g+= [bal(*b) for b in B]
    # détail A : sortie de l'injecteur coaxial, agrandie
    g.append(f'<circle class="hid" cx="{X(30)}" cy="{Y0}" r="20"/><text x="{X(30)+16}" y="{Y0+34}">A</text>')
    cx,cy,fx,k=1095,185,1085,16
    d=['<g clip-path="url(#clipA)">']
    for s in (1,-1):
        for r1,r2 in ((0.85,1.75),(3.15,7)):
            ya,yb=sorted((cy-s*r1*k,cy-s*r2*k))
            d.append(f'<rect x="{cx-100}" y="{ya:.1f}" width="{fx-cx+100}" height="{yb-ya:.1f}" fill="url(#h-steel)" stroke="#f2f2f0" stroke-width="1.4"/>')
        d.append(arrow(cx-80,cy-s*2.45*k,fx-6,cy-s*2.45*k,GOX,1.6))
        d.append(f'<path d="M{fx+4} {cy-s*2.45*k:.1f}L{fx+70} {cy-s*0.9*k:.1f}M{fx+4} {cy-s*2.9*k:.1f}L{fx+80} {cy-s*2.2*k:.1f}" stroke="{GOX}" stroke-width="1" stroke-dasharray="4 4"/>')
        d.append(f'<path d="M{fx+4} {cy-s*0.5*k:.1f}L{fx+80} {cy-s*1.6*k:.1f}" stroke="{ETH}" stroke-width="1" stroke-dasharray="4 4"/>')
    d.append(arrow(cx-80,cy,fx-6,cy,ETH,1.8)); d.append(f'<path d="M{fx+4} {cy}H{fx+84}" stroke="{ETH}" stroke-width="1" stroke-dasharray="4 4"/>')
    d.append('</g>')
    g.append(''.join(d)+f'<circle cx="{cx}" cy="{cy}" r="88" stroke-width="1.4"/><text x="{cx}" y="{cy+110}" text-anchor="middle">Détail A, agrandi</text><text x="{cx}" y="{cy+126}" text-anchor="middle" class="mu">Sortie de l\'injecteur coaxial</text>')
    # profils le long de l'axe : pression et nombre de Mach (allure qualitative)
    xa,xb=X(30),X(178); t,b=452,548
    g.append(f'<path class="hid" d="M{X(30)} 424V{b}M{X(145)} 424V{b}M{X(168)} 424V{b}M{X(178)} 424V{b}"/>')
    g.append(f'<path d="M{xa} {t-8}V{b}H{xb+26}" stroke-width="1.3"/>')
    g.append(f'<path d="M{xa} 462H{X(132)}C{X(150)} 462 {X(160)} 478 {X(168)} 503S{X(175)} 533 {X(178)} 538" stroke-width="1.8"/>')
    g.append(f'<path d="M{xa} 540H{X(132)}C{X(150)} 540 {X(161)} 524 {X(168)} 500S{X(174)} 470 {X(178)} 462" stroke="{RED}" stroke-width="1.8"/>')
    g.append(f'<text x="{X(50)}" y="456">Pression</text><text x="{X(50)}" y="534" fill="#ff6a61">Nombre de Mach</text><circle cx="{X(168)}" cy="501" r="3" fill="#ff6a61" stroke="none"/><text x="{X(160)-6}" y="507" text-anchor="end" fill="#ff6a61">M = 1 au col</text>')
    g.append(f'<text class="mu" x="{X(30)}" y="564" text-anchor="middle">Injecteur</text><text class="mu" x="{X(145)}" y="564" text-anchor="middle">Convergent</text><text class="mu" x="{X(168)-4}" y="564" text-anchor="middle">Col</text><text class="mu" x="{X(178)+8}" y="564">Sortie</text>')
    g.append(f'<text class="mu" x="{xa-10}" y="{t+4}" text-anchor="end">Évolution le long</text><text class="mu" x="{xa-10}" y="{t+18}" text-anchor="end">de l\'axe (allure)</text>')
    o.append('<g class="f">'+''.join(g)+'</g>')
    return '0 0 1200 580',''.join(o)

# ---------------------------------------------------------------- PLANCHE 2 : coupe de la fusée, deux vues + coupe B-B
def plate2():
    import math
    o=[]; g=[]; R=62; T=4; RI=R-T
    o.append('<defs><pattern id="h-a" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#f2f2f0" stroke-width=".9" opacity=".42"/></pattern>'
             '<pattern id="h-b" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#f2f2f0" stroke-width=".9" opacity=".42"/></pattern></defs>')
    def cut(x,y,w,h,pat='h-a',col='#f2f2f0'): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{pat})" stroke="{col}" stroke-width="1.3"/>'
    def both(A,x,r1,w,h,pat='h-a'): return cut(x,A-r1,w,h,pat)+cut(x,A+r1-h,w,h,pat)
    def tank(A,x1,x2,r,t=4):
        e=r/2; ei=e-t; ri=r-t
        outer=f'M{x1+e} {A-r}H{x2-e}A{e} {r} 0 0 1 {x2-e} {A+r}H{x1+e}A{e} {r} 0 0 1 {x1+e} {A-r}Z'
        inner=f'M{x1+e} {A-ri}H{x2-e}A{ei} {ri} 0 0 1 {x2-e} {A+ri}H{x1+e}A{ei} {ri} 0 0 1 {x1+e} {A-ri}Z'
        return outer,inner,e
    def bow(x,y,w=9,h=6): return f'<path d="M{x-w} {y-h}L{x+w} {y+h}V{y-h}L{x-w} {y+h}Z" fill="#000" stroke-width="1.3"/><path d="M{x} {y}V{y-11}" stroke-width="1.1"/><rect x="{x-5}" y="{y-19}" width="10" height="8" fill="#000" stroke-width="1.1"/>'
    def ubolt(x,A,d=1): return f'<path d="M{x} {A-7}h{9*d}v14h{-9*d}" stroke-width="1.8"/>'
    def zig(x1,x2,A,amp,n):
        st=(x2-x1)/n; pts=[f'{x1} {A}']+[f'{x1+st*(i+.5):.1f} {A+(amp if i%2 else -amp)}' for i in range(n)]+[f'{x2} {A}']
        return '<path d="M'+'L'.join(pts)+'" stroke-width="1.1"/>'
    def bag(x,y,w,h): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#000" stroke-width="1.5"/><path class="thin" d="M{x} {y}L{x+w} {y+h}M{x+w} {y}L{x} {y+h}M{x+w*.3:.0f} {y}V{y+h}M{x+w*.7:.0f} {y}V{y+h}"/>'
    def well(x,y): return f'<rect x="{x}" y="{y}" width="12" height="16" fill="{RED}" fill-opacity=".3" stroke="{RED}" stroke-width="1.3"/>'
    def match(x,A,h,t): return f'<path class="axis" d="M{x} {A-h}V{A+h}"/><path d="M{x-7} {A-h}H{x+7}M{x-7} {A+h}H{x+7}" stroke-width="1.6"/><text x="{x}" y="{A-h-8}" text-anchor="middle">{t}</text><text x="{x}" y="{A+h+16}" text-anchor="middle">{t}</text>'

    # =========================== VUE 1 : partie avant ===========================
    A=162
    g.append(f'<text class="mu" x="60" y="34">Vue 1, partie avant</text>')
    # tube, coupleur, épaulement d'ogive
    g.append(both(A,60,R,145,T)+both(A,205,R,435,T))
    g.append(both(A,150,RI,112,T,'h-b')+both(A,322,RI,186,T,'h-b')+both(A,592,RI,48,T,'h-b'))
    # ogive tangente : paroi coupée, pointe métallique massive
    L=260; rho=(R*R+L*L)/(2*R)
    def yo(x): return math.sqrt(rho*rho-(x-640)**2)-(rho-R)
    xs=list(range(640,901,10))
    up=' '.join(f'{x} {A-yo(x):.1f}' for x in xs); lo=' '.join(f'{x} {A+yo(x):.1f}' for x in reversed(xs))
    xi=[x for x in range(640,871,10)]
    iu=' '.join(f'{x} {A-max(yo(x)-T,0):.1f}' for x in reversed(xi)); il=' '.join(f'{x} {A+max(yo(x)-T,0):.1f}' for x in xi)
    g.append(f'<path d="M{up} L{iu}Z" fill="url(#h-a)" stroke="none"/><path d="M{lo} L{il}Z" fill="url(#h-a)" stroke="none"/>')
    g.append(f'<path d="M870 {A-yo(870):.1f}L900 {A}L870 {A+yo(870):.1f}Z" fill="url(#h-b)" stroke-width="1.3"/>')
    o.append(f'<path class="d" pathLength="1" d="M{up}"/><path class="d" pathLength="1" d="M{lo}"/>')
    g.append(f'<path d="M{iu}" stroke-width="1"/><path d="M{il}" stroke-width="1"/>')
    yb=yo(706)-T
    g.append(cut(700,A-yb,8,2*yb)+ubolt(700,A,-1))
    # réservoir de pressurisation, berceaux, piquage
    ot,it,e=tank(A,82,180,40)
    g.append(f'<path d="{ot}{it}" fill="url(#h-b)" fill-rule="evenodd" stroke="none"/>'); o.append(f'<path class="d" pathLength="1" d="{ot}"/>'); g.append(f'<path d="{it}" stroke-width="1"/>')
    g.append(both(A,104,RI,6,18)+both(A,152,RI,6,18)+f'<rect x="72" y="{A-6}" width="10" height="12" fill="#000" stroke-width="1.3"/><path d="M72 {A}H60" stroke-width="1.8"/>')
    # cloison, parachute de freinage
    g.append(cut(190,A-RI,10,2*RI)+ubolt(200,A)+zig(209,250,A,20,7)+bag(254,A-28,50,56)+f'<path d="M304 {A}H321" stroke-width="1.1"/>'+ubolt(330,A,-1)+well(318,A+24))
    # baie avionique
    g.append(cut(330,A-RI+T,10,2*(RI-T))+cut(490,A-RI+T,10,2*(RI-T)))
    for y in (A-41,A+38): g.append(f'<rect x="322" y="{y}" width="186" height="3" fill="#000" stroke-width="1"/><rect x="322" y="{y-3}" width="6" height="9" fill="#000" stroke-width="1"/><rect x="502" y="{y-3}" width="6" height="9" fill="#000" stroke-width="1"/>')
    g.append(f'<rect x="346" y="{A+2}" width="138" height="3" fill="#f2f2f0" stroke="none"/>')
    g.append(f'<path d="M360 {A+2}V{A-8}M420 {A+2}V{A-8}M440 {A+2}V{A-8}M472 {A+2}V{A-8}" stroke-width="1.6"/><rect x="354" y="{A-11}" width="72" height="3" fill="#000" stroke-width="1.1"/><rect x="434" y="{A-11}" width="44" height="3" fill="#000" stroke-width="1.1"/>')
    g.append(f'<path class="thin" d="M362 {A-11}v-8h12v8M380 {A-11}v-12h18v12M404 {A-11}v-6h8v6M416 {A-11}v-10h6v10M440 {A-11}v-7h10v7M456 {A-11}v-10h13v10"/>')
    g.append(f'<rect x="354" y="{A+9}" width="48" height="24" fill="#000" stroke-width="1.3"/><path class="thin" d="M402 {A+14}h4v5h-4M402 {A+23}h4v5h-4M362 {A+21}h8M366 {A+17}v8"/><rect x="412" y="{A+9}" width="34" height="24" fill="#000" stroke-width="1.3"/><path class="thin" d="M420 {A+21}h8"/>')
    g.append(f'<rect x="454" y="{A+9}" width="26" height="14" fill="#000" stroke-width="1.3"/><path d="M467 {A+23}V{A+52}" stroke-width="1.3"/><path class="thin" d="M459 {A+74}L467 {A+82}L475 {A+74}M453 {A+80}L467 {A+94}L481 {A+80}"/>')
    g.append(f'<rect x="440" y="{A-R-6}" width="12" height="6" fill="#000" stroke-width="1.3"/><path class="thin" d="M446 {A-R}V{A-21}"/>')
    # parachute principal
    g.append(well(500,A-42)+ubolt(500,A)+zig(509,560,A,26,8)+bag(564,A-38,96,76)+f'<path d="M660 {A}H691" stroke-width="1.1"/>')
    # axe, plans de séparation, raccord
    g.append(f'<path class="axis" d="M40 {A}H930"/>'+match(60,A,96,'A'))
    for x,t in ((205,'S1'),(640,'S2')): g.append(f'<path d="M{x} {A-84}V{A+84}" stroke="{RED}" stroke-width="1.2" stroke-dasharray="10 4 2 4"/><text x="{x}" y="{A-90}" text-anchor="middle" fill="#ff6a61">{t}</text>')
    B1=[(10,131,52,131,A-36),(9,279,52,279,A-24),(5,392,52,392,A-20),(8,446,34,446,A-R-3),(4,530,52,506,A-34),(2,612,52,612,A-34),(1,790,52,790,round(A-yo(790)+2)),
        (3,232,274,232,A+16),(6,380,274,380,A+28),(7,467,274,467,A+16)]
    g+=[bal(*b) for b in B1]
    # cartouche
    g.append('<g stroke-width="1.2"><rect x="948" y="56" width="232" height="112" fill="#000"/><path d="M948 90H1180M948 134H1180M1064 134V168"/></g>'
             '<text x="960" y="78" style="font-weight:700;letter-spacing:.12em">HELVETIC DYNAMICS</text><text x="960" y="108">Fusée à ergols liquides</text><text class="mu" x="960" y="124">Coupe longitudinale</text>'
             '<text class="mu" x="960" y="155">Planche 2 / 3</text><text class="mu" x="1076" y="155">Sans échelle</text>')
    g.append(arrow(1000,214,1110,214,'#9a9b9f',1.2)+'<text class="mu" x="1055" y="204" text-anchor="middle">Sens du vol</text>')

    # =========================== VUE 2 : partie arrière ===========================
    A=518; E=1.25; X0=302.5
    g.append(f'<text class="mu" x="60" y="352">Vue 2, partie arrière</text>')
    g.append(both(A,95,R,850,T))
    # moteur (même géométrie que la planche 1), bagues de centrage, bâti-moteur
    HB=[[0,40],[14.4,40],[14.4,12.5],[10,12.5],[10,1.75],[30,1.75],[30,0.85],[0,0.85]]
    HF=[[20.4,40],[30,40],[30,3.15],[25,3.15],[25,12.5],[20.4,12.5]]
    CU=[[30,30],[178,30],[178,10],[168,7.5],[145,21],[30,21]]
    def poly(P,sg): return 'M'+'L'.join(f'{X0-E*x:.1f} {A-sg*E*r:.1f}' for x,r in P)+'Z'
    for P in (HB,HF):
        for sg in (1,-1): g.append(f'<path d="{poly(P,sg)}" fill="url(#h-steel)" stroke-width="1.2"/>')
    for sg in (1,-1): g.append(f'<path d="{poly(CU,sg)}" fill="url(#h-cu)" stroke="#D08A5E" stroke-width="1.3"/>')
    g.append(both(A,100,RI,6,RI-37.5,'h-b')+both(A,256,RI,6,RI-37.5,'h-b')+cut(303,A-RI,10,2*RI,'h-b'))
    for r in (0,6,-6): g.append(arrow(76,A+r,48,A+r*1.7,RED,1.3))
    # ailerons : emplanture, bord d'attaque en flèche, tenons traversants
    for sg in (1,-1):
        o.append(f'<path class="d" pathLength="1" d="M290 {A-sg*R}L190 {A-sg*(R+66)}H110L95 {A-sg*R}"/>')
        y1,y2=sorted((A-sg*RI,A-sg*37.5)); g.append(f'<rect class="hid" x="112" y="{y1}" width="138" height="{y2-y1}"/>')
    # réservoirs : parois coupées, fonds elliptiques, anneaux anti-ballottement, piquages
    for x1,x2,col in ((400,620,ETH),(660,880,GOX)):
        ot,it,e=tank(A,x1,x2,54)
        g.append(f'<path d="{it}" fill="{col}" opacity=".1" stroke="none"/><path d="{ot}{it}" fill="url(#h-b)" fill-rule="evenodd" stroke="none"/><path d="{it}" stroke-width="1"/>')
        o.append(f'<path class="d" pathLength="1" d="{ot}"/>')
        g.append(f'<path class="thin" d="M{x1+e} {A-54}V{A+54}M{x2-e} {A-54}V{A+54}"/>')
        for xb in (x1+70,x1+110,x1+150): g.append(f'<path d="M{xb} {A-50}v15M{xb} {A+50}v-15" stroke-width="1.6"/>')
        g.append(f'<rect x="{x1-8}" y="{A-6}" width="8" height="12" fill="#000" stroke-width="1.3"/><rect x="{x2}" y="{A-6}" width="8" height="12" fill="#000" stroke-width="1.3"/>')
    g.append(both(A,636,RI,6,12))
    # alimentation carburant et comburant, vannes principales
    g.append(f'<path d="M392 {A}H313" stroke="{ETH}" stroke-width="2"/>'+bow(352,A))
    g.append(f'<path d="M652 {A}V{A+R+5}H380V{A+40}H340V{A+54}H280.75V{A+50}" stroke="{GOX}" stroke-width="2"/>'+bow(360,A+40))
    g.append(f'<rect class="hid" x="372" y="{A+R}" width="290" height="10"/>')
    # pressurisation : détendeur, piquages vers les deux réservoirs
    g.append(f'<path d="M945 {A}H888M928 {A}V{A-R-5}H640V{A-14}H628" stroke-width="1.6"/><circle class="dot" cx="928" cy="{A}" r="2.6"/>'+bow(910,A)+f'<rect class="hid" x="632" y="{A-R-10}" width="304" height="10"/>')
    # patins de rampe
    for x in (330,905): g.append(f'<path d="M{x-4} {A+R}v7h-5v4h18v-4h-5v-7" stroke-width="1.3" fill="#000"/>')
    # axe, raccord, plan de coupe B-B
    g.append(f'<path class="axis" d="M30 {A}H965"/>'+match(945,A,96,'A'))
    g.append(f'<path class="axis" d="M180 {A-150}V{A+150}"/><path d="M180 {A-150}H168M180 {A+150}H168" stroke-width="1.8"/>'+arrow(176,A-150,160,A-150,'#f2f2f0',1.4)+arrow(176,A+150,160,A+150,'#f2f2f0',1.4)+f'<text x="192" y="{A-146}">B</text><text x="192" y="{A+154}">B</text>')
    # stabilité
    def cgs(x,y): return f'<circle cx="{x}" cy="{y}" r="7" fill="#000"/><path d="M{x} {y-7}A7 7 0 0 1 {x+7} {y}H{x}ZM{x} {y+7}A7 7 0 0 1 {x-7} {y}H{x}Z" fill="#f2f2f0" stroke="none"/>'
    g.append(f'<path class="hid" d="M700 {A+R+2}V{A+110}M520 {A+R+12}V{A+110}"/>')
    g.append(dim_h(520,700,A+118,'Marge statique',A+146)+cgs(700,A+118)+f'<circle cx="520" cy="{A+118}" r="7" fill="#000"/><circle cx="520" cy="{A+118}" r="2.4" fill="{RED}" stroke="none"/><text x="714" y="{A+122}">CG</text><text x="506" y="{A+122}" text-anchor="end">CP</text>')
    B2=[(19,58,A-112,150,A-R-30),(17,318,A-112,308,A-40),(16,372,A-112,352,A-8),(14,500,A-112,500,A-50),(13,558,A-112,550,A-40),(12,790,A-112,790,A-50),(11,900,A-112,910,A-8),
        (18,44,A+92,170,A+31),(20,330,A+112,330,A+R+11),(15,440,A+112,440,A+R+5)]
    g+=[bal(*b) for b in B2]
    # =========================== COUPE B-B ===========================
    cx,cy=1068,A
    g.append(f'<path d="M{cx-R} {cy}a{R} {R} 0 1 0 {2*R} 0a{R} {R} 0 1 0 {-2*R} 0ZM{cx-RI} {cy}a{RI} {RI} 0 1 0 {2*RI} 0a{RI} {RI} 0 1 0 {-2*RI} 0Z" fill="url(#h-a)" fill-rule="evenodd" stroke-width="1.4"/>')
    g.append(f'<path d="M{cx-37.5} {cy}a37.5 37.5 0 1 0 75 0a37.5 37.5 0 1 0 -75 0ZM{cx-26.25} {cy}a26.25 26.25 0 1 0 52.5 0a26.25 26.25 0 1 0 -52.5 0Z" fill="url(#h-cu)" fill-rule="evenodd" stroke="#D08A5E" stroke-width="1.3"/>')
    for ang in (0,90,180,270):
        g.append(f'<g transform="rotate({ang} {cx} {cy})"><rect x="{cx-2.5}" y="{cy-R-66}" width="5" height="66" fill="url(#h-b)" stroke-width="1.3"/><rect class="hid" x="{cx-2.5}" y="{cy-RI}" width="5" height="{RI-37.5}"/></g>')
    g.append(f'<path class="axis" d="M{cx-R-74} {cy}H{cx+R+74}M{cx} {cy-R-74}V{cy+R+74}"/><text x="{cx}" y="{cy+R+100}" text-anchor="middle">Coupe B-B</text><text class="mu" x="{cx}" y="{cy+R+116}" text-anchor="middle">Section au niveau des ailerons</text>')
    g+= [bal(18,cx+92,cy-92,cx+24,cy-22),bal(19,cx+112,cy+72,cx+2,cy+R+40)]
    o.append('<g class="f">'+''.join(g)+'</g>')
    return '0 0 1200 712',''.join(o)

# ---------------------------------------------------------------- PLANCHE 3 : schéma fluide du banc d'essai
def plate3():
    g=[]; o=[]
    Yp,Yf,Yo,Yu=110,280,400,330; W='#f2f2f0'
    # lignes (tracées)
    o.append(f'<path class="d" pathLength="1" d="M80 140V{Yp}H470V140M320 {Yp}V{Yu}H760V{Yo}"/>')
    o.append(f'<path class="d" pathLength="1" stroke="{ETH}" d="M470 250V{Yf}H906V310"/>')
    o.append(f'<path class="d" pathLength="1" stroke="{GOX}" d="M80 430V{Yo}H918V370"/>')
    def val(x,y): return f'<path d="M{x-10} {y-7}L{x+10} {y+7}V{y-7}L{x-10} {y+7}Z" fill="#000"/>'
    def man(x,y,t): return val(x,y)+f'<path d="M{x} {y}V{y-13}M{x-7} {y-13}H{x+7}" stroke-width="1.3"/><text class="tag" x="{x}" y="{y+24}" text-anchor="middle">{t}</text>'
    def sol(x,y,t): return val(x,y)+f'<path d="M{x} {y}V{y-10}" stroke-width="1.3"/><rect x="{x-7}" y="{y-21}" width="14" height="11" fill="#000"/><path class="thin" d="M{x-4} {y-13}l8 -5"/><text class="tag" x="{x}" y="{y+24}" text-anchor="middle">{t}</text>'
    def reg(x,y,t): return val(x,y)+f'<path d="M{x} {y}V{y-9}M{x-9} {y-9}H{x+9}A9 9 0 0 0 {x-9} {y-9}" stroke-width="1.3" fill="#000"/><path class="thin" d="M{x+9} {y-13}H{x+16}V{y}"/><text class="tag" x="{x}" y="{y+24}" text-anchor="middle">{t}</text>'
    def chk(x,y,t): return f'<path d="M{x-8} {y-7}L{x+6} {y}L{x-8} {y+7}Z" fill="#000"/><path d="M{x+6} {y-7}V{y+7}"/><text class="tag" x="{x}" y="{y+24}" text-anchor="middle">{t}</text>'
    def ins(t,x,y,tx,ty): return f'<path class="thin" d="M{x} {y+(14 if ty>y else -14)}V{ty}"/><circle cx="{x}" cy="{y}" r="14" fill="#000"/><text class="bn" x="{x}" y="{y+3.6}" text-anchor="middle">{t}</text>' if tx==x else f'<path class="thin" d="M{x+14} {y}H{tx}V{ty}"/><circle cx="{x}" cy="{y}" r="14" fill="#000"/><text class="bn" x="{x}" y="{y+3.6}" text-anchor="middle">{t}</text>'
    def bottle(x,y1,y2,t): return f'<path d="M{x-18} {y1+18}A18 18 0 0 1 {x+18} {y1+18}V{y2-8}A8 8 0 0 1 {x+10} {y2}H{x-10}A8 8 0 0 1 {x-18} {y2-8}Z" fill="#000"/><text x="{x}" y="{(y1+y2)/2+8}" text-anchor="middle">{t}</text>'
    g.append(bottle(80,140,240,'N₂')+bottle(80,430,530,'GOX'))
    # réservoir d'éthanol
    g.append(f'<rect x="440" y="140" width="60" height="110" rx="26" fill="#000"/><path d="M441 185H499V224A26 26 0 0 1 473 250H467A26 26 0 0 1 441 224Z" fill="{ETH}" opacity=".16" stroke="none"/><path class="thin" d="M441 185H499"/><text x="470" y="216" text-anchor="middle" fill="{ETH}">Éthanol</text>')
    # organes
    g.append(reg(160,Yp,'PR-1')+man(270,Yp,'MV-1')+chk(378,Yp,'CV-1')+ins('PT',215,62,215,Yp))
    g.append(f'<path d="M425 {Yp}V92M418 92L432 72H418L432 92Z" fill="#000"/><path class="thin" d="M425 72l-4 -4 8 -4 -8 -4 4 -4"/>'+arrow(436,82,452,70,'#9a9b9f',1.1)+f'<text class="tag" x="440" y="58">RV-1</text>')
    g.append(sol(640,Yf,'SV-F')+ins('PT',730,236,730,Yf))
    g.append(reg(160,Yo,'PR-2')+man(270,Yo,'MV-2')+sol(640,Yo,'SV-O')+chk(702,Yo,'CV-2')+ins('PT',215,446,215,Yo)+ins('PT',820,446,820,Yo))
    g.append(sol(520,Yu,'SV-P')+chk(585,Yu,'CV-3')+f'<text class="mu" x="400" y="{Yu-8}" text-anchor="middle">Purge azote</text>')
    for x,y in ((320,Yp),(760,Yo)): g.append(f'<circle cx="{x}" cy="{y}" r="3" fill="{W}" stroke="none"/>')
    for x,y,c in ((560,Yf,ETH),(800,Yf,ETH),(440,Yo,GOX),(560,Yo,GOX),(440,Yu,W)): g.append(f'<path d="M{x-6} {y-4}L{x+2} {y}L{x-6} {y+4}" stroke="{c}"/>')
    # moteur sur son bâti, capteur de force, allumeur
    g.append(f'<rect x="900" y="310" width="25" height="60" fill="url(#h-steel)"/><path d="M925 318H1000L1022 333L1052 322M925 362H1000L1022 347L1052 358" stroke="#D08A5E" stroke-width="3"/><path class="axis" d="M880 340H1100"/>')
    for r in (0,9,-9): g.append(arrow(1058,340+r,1086,340+r*1.5,RED,1.3))
    g.append(f'<rect x="874" y="331" width="26" height="18" fill="#000"/><path d="M868 316V364" stroke-width="2.4"/><path class="thin" d="M868 320l-7 7M868 331l-7 7M868 342l-7 7M868 353l-7 7M868 364l-7 7"/>')
    g.append(f'<path class="thin" d="M859 300H887V331"/><circle cx="845" cy="300" r="14" fill="#000"/><text class="bn" x="845" y="303.6" text-anchor="middle">WT</text>')
    g.append(ins('PT',950,258,950,318)+ins('TT',996,258,996,316))
    g.append(f'<path d="M960 362V378" stroke-width="1.3"/><rect x="953" y="378" width="14" height="12" fill="#000"/><path d="M957 387l3 -6 0 4 3 -6" stroke="{RED}" stroke-width="1.1"/><text class="tag" x="974" y="388">IGN</text>')
    g.append(f'<rect class="hid" x="818" y="218" width="296" height="186" rx="4"/><text class="mu" x="1108" y="234" text-anchor="end">Banc d\'essai</text>')
    # commande et mesure
    def box(x,y,w,h,t1,t2=''): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#000" stroke-width="1.5"/><text x="{x+w/2}" y="{y+h/2+(-3 if t2 else 4)}" text-anchor="middle" fill="#f2f2f0">{t1}</text>'+(f'<text class="mu" x="{x+w/2}" y="{y+h/2+13}" text-anchor="middle">{t2}</text>' if t2 else '')
    g.append(f'<path class="sig" d="M640 500V292M520 500V340M680 500V470H960V390M820 460V485H1140V258H1010M964 258H982M845 314V485M870 485V500M710 525H760M400 525H450"/>')
    g.append(box(130,500,270,52,'Poste de commande','à distance, opérateurs à l\'abri')+box(450,500,260,52,'Séquenceur de mise à feu','compte à rebours, arrêt d\'urgence')+box(760,500,250,52,'Acquisition de données','pression, poussée, température'))
    g.append(f'<path d="M417 517l8 16M425 517l8 16" stroke="#000" stroke-width="5"/><path d="M417 517l8 16M425 517l8 16" stroke-width="1.2"/>')
    o.append('<g class="f">'+''.join(g)+'</g>')
    return '0 0 1200 568',''.join(o)

def stage(n,title,text,svg,h,aria,cap,legend,cls=''):
    return f'''      <article class="stage">
        <header class="stage__head">
          <div><span class="domain__alt" data-t="st.tier{n}">{EN('st.tier'+str(n))}</span><h3 data-t="{title}">{EN(title)}</h3></div>
          <p data-t="{text}">{EN(text)}</p>
        </header>
        <figure class="plate">
          <div class="plate__scroll"><svg viewBox="{h}" role="img" data-ta="aria-label:{aria}" aria-label="{EN(aria)}">{localize(svg)}</svg></div>
          {legend}
          <figcaption><span data-t="{cap}">{EN(cap)}</span><span data-t="st.cap2.{n}">{EN('st.cap2.'+str(n))}</span></figcaption>
        </figure>
      </article>
'''
def ol(keys): return '<ol class="legend legend--link">'+''.join(f'<li><button type="button" data-n="{k+1}" data-t="{key}">{EN(key)}</button></li>' for k,key in enumerate(keys))+'</ol>'
def tags(items): return '<ul class="legend legend--tags">'+''.join(f'<li><b>{a}</b><span data-t="{key}">{EN(key)}</span></li>' for a,key in items)+'</ul>'

h1,s1=plate1(); h2,s2=plate2(); h3,s3=plate3()
html='    <div class="wrap stages">\n'
html+=stage(1,'st1.title','st1.text',s1,h1,'st1.aria','st1.cap',
  ol(['pl1.l%d'%k for k in range(1,12)]))
html+=stage(2,'st2.title','st2.text',s2,h2,'st2.aria','st2.cap',
  ol(['pl2.l%d'%k for k in range(1,21)])
  +f'<p class="legend__note" data-t="pl2.note">{EN("pl2.note")}</p>')
html+=stage(3,'st3.title','st3.text',s3,h3,'st3.aria','st3.cap',
  tags(list(zip(['PR','MV','CV','RV','SV-F','SV-O','SV-P','PT','TT','WT','IGN'],
                ['pl3.t%d'%k for k in range(1,12)]))))
rest = [k for k, v in LEFT.items() if v]
assert not rest, 'textes jamais rencontres : ' + repr(rest)
html+='    </div>\n  </section>\n\n'
p='/home/claude/repo/index.html'; s=open(p,encoding='utf-8').read()
a=s.index('    <div class="wrap stages">'); b=s.index('  <!-- ============ ASCENSION')
open(p,'w',encoding='utf-8').write(s[:a]+html+s[b:]); print('ok',len(html))
