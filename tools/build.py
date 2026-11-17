# -*- coding: utf-8 -*-
"""Construit les versions française et allemande du site à partir de index.html (anglais),
ainsi que i18n.js, le fichier de textes utilisé par les scripts."""
import json, re, sys
from tr import T

REPO = '/home/claude/repo/'
IDX = {'en': 0, 'fr': 1, 'de': 2}
SITE = 'https://helvetic-dynamics.ch/'
FILE = {'en': 'index.html', 'fr': 'fr.html', 'de': 'de.html'}

def contents(s, lang):
    """Traduit le contenu des éléments porteurs de data-t."""
    i, used = IDX[lang], set()
    pat = re.compile(r'<([a-zA-Z0-9]+)((?:[^<>"]|"[^"]*")*?\sdata-t="([^"]+)"(?:[^<>"]|"[^"]*")*)>(.*?)</\1>', re.S)
    def sub(m):
        key = m.group(3)
        assert key in T, 'clé inconnue : ' + key
        used.add(key)
        return '<' + m.group(1) + m.group(2) + '>' + T[key][i] + '</' + m.group(1) + '>'
    return pat.sub(sub, s), used

def attributes(s, lang):
    """Traduit les attributs listés dans data-ta (aria-label:clé, …)."""
    i, used = IDX[lang], set()
    def sub(m):
        tag = m.group(0)
        for spec in re.search(r'data-ta="([^"]+)"', tag).group(1).split(';'):
            attr, key = spec.split(':', 1)
            assert key in T, 'clé inconnue : ' + key
            used.add(key)
            tag = re.sub(attr + r'="(?:[^"]*)"', lambda _: attr + '="' + T[key][i].replace('"', '&quot;') + '"', tag, count=1)
        return tag
    return re.sub(r'<[^<>]*data-ta="[^"]+"[^<>]*>', sub, s), used

def head(s, lang):
    i = IDX[lang]
    s = s.replace('<html lang="en"', '<html lang="%s"' % lang, 1)
    s = re.sub(r'<title>[^<]*</title>', '<title>' + T['meta.title'][i] + '</title>', s, count=1)
    s = re.sub(r'(<meta name="description" content=")[^"]*', r'\g<1>' + T['meta.desc'][i], s, count=1)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*', r'\g<1>' + T['meta.title'][i], s, count=1)
    s = re.sub(r'(<meta property="og:description" content=")[^"]*', r'\g<1>' + T['meta.ogdesc'][i], s, count=1)
    s = re.sub(r'"description":"[^"]*"', '"description":"' + T['meta.ldesc'][i] + '"', s, count=1)
    loc = {'en': 'en_GB', 'fr': 'fr_CH', 'de': 'de_CH'}
    alt = ''.join('\n<meta property="og:locale:alternate" content="%s">' % loc[l] for l in ('en', 'fr', 'de') if l != lang)
    s = re.sub(r'<meta property="og:locale" content="[^"]*">(\n<meta property="og:locale:alternate" content="[^"]*">)*',
               '<meta property="og:locale" content="%s">%s' % (loc[lang], alt), s, count=1)
    url = SITE + ('' if lang == 'en' else FILE[lang])
    s = s.replace('<link rel="canonical" href="%s">' % SITE, '<link rel="canonical" href="%s">' % url, 1)
    s = s.replace('<meta property="og:url" content="%s">' % SITE, '<meta property="og:url" content="%s">' % url, 1)
    return s

def switcher(s, lang):
    s = s.replace(' aria-current="true"', '', 1)
    return s.replace('<a href="%s" hreflang="%s" lang="%s">' % (FILE[lang], lang, lang),
                     '<a href="%s" hreflang="%s" lang="%s" aria-current="true">' % (FILE[lang], lang, lang), 1)

def page(src, lang):
    s, u1 = contents(src, lang)
    s, u2 = attributes(s, lang)
    return head(switcher(s, lang), lang), u1 | u2

def main():
    src = open(REPO + 'index.html', encoding='utf-8').read()
    used = set()
    for lang in ('fr', 'de'):
        out, u = page(src, lang)
        used |= u
        open(REPO + FILE[lang], 'w', encoding='utf-8').write(out)
        print(FILE[lang], len(out))
    # i18n.js : uniquement les textes dont les scripts ont besoin
    js = {l: {k: v[IDX[l]] for k, v in T.items() if k.startswith('js.')} for l in ('en', 'fr', 'de')}
    used |= set(js['en'])
    body = ('/* Textes des parties animées du site, dans les trois langues.\n'
            '   Généré par tools/build.py — ne pas modifier à la main. */\n'
            '(function () {\n'
            "  var S = %s;\n"
            "  var L = (document.documentElement.lang || 'en').slice(0, 2);\n"
            "  if (!S[L]) L = 'en';\n"
            "  var DEC = { en: '.', fr: ',', de: ',' }, THO = { en: ',', fr: '\\u00a0', de: '.' };\n"
            '  var H = window.HD = window.HD || {};\n'
            '  H.lang = L;\n'
            "  H.t = function (k) { var d = S[L]; return d && d[k] != null ? d[k] : (S.en[k] != null ? S.en[k] : k); };\n"
            '  H.num = function (v, d) {\n'
            '    var p = Math.abs(v).toFixed(d == null ? 0 : d).split(\'.\');\n'
            "    p[0] = p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, THO[L]);\n"
            "    return (v < 0 ? '\\u2212' : '') + p.join(DEC[L]);\n"
            '  };\n'
            '})();\n') % json.dumps(js, ensure_ascii=False, sort_keys=True, indent=1)
    open(REPO + 'i18n.js', 'w', encoding='utf-8').write(body)
    # plan du site
    pages = ''.join('<url><loc>%s</loc><xhtml:link rel="alternate" hreflang="en" href="%s"/>'
                    '<xhtml:link rel="alternate" hreflang="fr" href="%sfr.html"/>'
                    '<xhtml:link rel="alternate" hreflang="de" href="%sde.html"/></url>'
                    % (SITE + ('' if l == 'en' else FILE[l]), SITE, SITE, SITE) for l in ('en', 'fr', 'de'))
    open(REPO + 'sitemap.xml', 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">' + pages + '</urlset>\n')
    # clés jamais employées : signe d'une traduction oubliée
    unused = sorted(set(T) - used - {'meta.title', 'meta.desc', 'meta.ogdesc', 'meta.ldesc'})
    if unused: print('clés inutilisées :', unused)

main()
