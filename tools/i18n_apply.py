# -*- coding: utf-8 -*-
"""Passe le corps de index.html en anglais et pose les clés de traduction.
À n'exécuter qu'une fois : il part de la version française."""
import re, sys
from tr import T

P = '/home/claude/repo/index.html'
s = open(P, encoding='utf-8').read()
head_end = s.index('</head>')

def put(key, nth=0, every=False, attr=None, force=False):
    """Remplace le texte français par l'anglais et pose data-t (ou data-ta) sur la balise."""
    global s
    en, fr, de = T[key]
    if attr:
        needle = attr + '="' + fr + '"'
        occ = [m.start() for m in re.finditer(re.escape(needle), s)]
    else:
        needle = '>' + fr + '<'
        occ = [m.start() for m in re.finditer(re.escape(needle), s)]
    occ = [o for o in occ if o > head_end]
    if not occ:
        print('INTROUVABLE', key, repr(fr[:60])); return False
    if not every and not force and len(occ) > 1:
        print('AMBIGU', key, len(occ), repr(fr[:40])); return False
    targets = occ if every else [occ[nth]]
    for start in sorted(targets, reverse=True):
        if attr:
            end = start + len(needle)
            tag0 = s.rindex('<', 0, start)
            s = s[:start] + attr + '="' + en + '"' + s[end:]
            s = s[:tag0] + s[tag0:].replace('<', '<', 1)
            # pose data-ta sur la même balise
            gt = s.index('>', tag0)
            s = s[:gt] + ' data-ta="' + attr + ':' + key + '"' + s[gt:]
        else:
            gt = start                      # le '>' qui ouvre le contenu
            end = start + len(needle) - 1   # le '<' de la balise fermante
            tag0 = s.rindex('<', 0, gt)
            s = s[:gt] + ' data-t="' + key + '"' + '>' + en + s[end:]
    return True

# certains libellés sont collés à une valeur : on les isole d'abord dans leur propre span
PRE = [
 ('<span class="k k--pc">Pression chambre <b id="tm-pc">', '<span class="k k--pc"><span>Pression chambre</span> <b id="tm-pc">'),
 ('<span class="k k--f">Poussée <b id="tm-f">', '<span class="k k--f"><span>Poussée</span> <b id="tm-f">'),
 ('<span>Régime <output id="engine-thr-o"', '<span><span>Régime</span> <output id="engine-thr-o"'),
 ('<span>Altitude <output id="lab-alt-o"', '<span><span>Altitude</span> <output id="lab-alt-o"'),
 ('<span>Pression de chambre <output id="lab-pc-o"', '<span><span>Pression de chambre</span> <output id="lab-pc-o"'),
 ('<span>Rapport de section sortie / col <output id="lab-e-o"', '<span><span>Rapport de section sortie / col</span> <output id="lab-e-o"'),
 ('</span> Helvetic Dynamics, association de propulsion</span>', '</span> <span>Helvetic Dynamics, association de propulsion</span></span>'),
]
for a, b in PRE:
    assert s.count(a) == 1, (a[:50], s.count(a))
    s = s.replace(a, b)

KEYS = [
 # navigation
 ('nav.skip',), ('nav.brand', 'aria-label'), ('nav.menu',), ('nav.aria', 'aria-label'),
 ('nav.mission', 'EVERY'), ('nav.ascent', 'EVERY'), ('nav.engine', 'EVERY'), ('nav.route', 'EVERY'), ('nav.contact',),
 # hero
 ('hero.label',), ('hero.lead',), ('hero.cta1',), ('hero.cta2',), ('hero.scroll', 'aria-label'),
 ('hero.ro', 'aria-label'), ('hero.lat',), ('hero.lon',), ('hero.alt',), ('hero.tkn',), ('hero.tke',),
 # mission
 ('mis.title',), ('mis.p1',), ('mis.p2',),
 ('mis.s1a',), ('mis.s1b',), ('mis.s2a',), ('mis.s2b',), ('mis.s3a',), ('mis.s3b',), ('mis.s4a',), ('mis.s4b',),
 # ascension
 ('asc.aria', 'aria-label'), ('asc.m1a', 'EVERY'), ('asc.m1b',), ('asc.m2a',), ('asc.m2b',), ('asc.m3a',), ('asc.m3b',),
 ('asc.m4a',), ('asc.m4b',), ('asc.m5a',), ('asc.m5b',), ('asc.m6a',), ('asc.m6b',),
 ('asc.l1',), ('asc.l2',), ('asc.p',), ('asc.t',), ('asc.a',),
 # moteur
 ('eng.label',), ('eng.title',), ('eng.lead',), ('eng.ph0',), ('eng.ph1',), ('eng.ph2',), ('eng.ph3',),
 ('eng.clock',), ('eng.aria', 'aria-label'), ('eng.lg1',), ('eng.lg2',), ('eng.lg3',), ('eng.lg4',),
 ('eng.kpc',), ('eng.kf',), ('eng.tmaria', 'aria-label'), ('eng.thr',), ('eng.cut',), ('eng.replay',), ('eng.note',),
 ('eng.sp1a',), ('eng.sp1b',), ('eng.sp2a',), ('eng.sp2b',), ('eng.sp3a',), ('eng.sp3b',), ('eng.sp4a',), ('eng.sp4b',),
 ('eng.sp5a',), ('eng.sp5b',), ('eng.sp6a',), ('eng.sp6b',), ('eng.sp7a',), ('eng.sp7b',), ('eng.sp8a',), ('eng.sp8b', 'FIRST'),
 # laboratoire
 ('lab.label',), ('lab.title',), ('lab.lead',), ('lab.aria', 'aria-label'), ('lab.alt',), ('lab.pc',), ('lab.e',),
 ('lab.o1',), ('lab.o2',), ('lab.o3',), ('lab.o4',), ('lab.o5',), ('lab.o6',), ('lab.note',),
 # parcours
 ('rt.label',), ('rt.title',),
 ('rt.k1',), ('rt.h1',), ('rt.p1',), ('rt.k2',), ('rt.h2',), ('rt.p2',), ('rt.k3',), ('rt.h3',), ('rt.p3',),
 ('rt.k4',), ('rt.h4',), ('rt.p4',), ('rt.k5',), ('rt.h5',), ('rt.p5',),
 # contact et pied de page
 ('ct.title',), ('ct.lead',), ('ct.mail', 'EVERY'), ('ct.loc',), ('ct.legend',),
 ('ct.c1',), ('ct.c2',), ('ct.c3',), ('ct.hint',), ('ct.name',), ('ct.msg',), ('ct.send',), ('ct.note',),
 ('ft.about',), ('ft.site',), ('ft.reach',), ('ft.write',), ('ft.rights',), ('ft.top',),
]
bad = []
for e in KEYS:
    k = e[0]
    if len(e) == 1: ok = put(k)
    elif e[1] == 'EVERY': ok = put(k, every=True)
    elif e[1] == 'FIRST': ok = put(k, nth=0, every=False, force=True)
    else: ok = put(k, attr=e[1])
    if not ok: bad.append(k)
if bad:
    print('\nÉCHECS :', bad); sys.exit(1)
open(P, 'w', encoding='utf-8').write(s)
print('ok', len(s))
