#!/usr/bin/env python3
"""Read a DiGiCo SD-series .ses session file.

Implements the layout in format/ses/ (one 2025 SD5 theatre session is the only sample so
far). Standard library only. Meanings it prints for parameters are inferred, not confirmed
in the offline software; see format/ses/components.md for the tags.

    python3 tools/ses_reader.py SESSION.ses                    summary to stdout
    python3 tools/ses_reader.py SESSION.ses --json OUT.json    full dump
    python3 tools/ses_reader.py SESSION.ses --csv OUT.csv      channel and bus list
    python3 tools/ses_reader.py SESSION.ses --scrub ...        replace every name with a neutral
                                                               label before any output (for samples/)
    python3 tools/ses_reader.py SESSION.ses --rename OLD NEW --out NEW.ses
                                                               experimental: rewrite one object's name
                                                               everywhere it is stored; never touches the
                                                               source file; untested on a console

Nothing in this file knows a show name. Nothing in this file should.
"""
import argparse
import csv
import datetime
import json
import re
import struct
import sys

# ----------------------------------------------------------------------------- primitives

def u8(d, o):  return d[o]
def u16(d, o): return struct.unpack_from('<H', d, o)[0]
def u32(d, o): return struct.unpack_from('<I', d, o)[0]
def i32(d, o): return struct.unpack_from('<i', d, o)[0]
def f32(d, o): return struct.unpack_from('<f', d, o)[0]
def f64(d, o): return struct.unpack_from('<d', d, o)[0]

def pstr(d, o, width):
    """Pascal string in a fixed-width field: length byte then chars, rest ignored."""
    ln = d[o]
    return d[o + 1:o + 1 + min(ln, width - 1)].decode('latin1', 'replace')

def wstr(d, o):
    """u16 length then chars (variable width). Returns (string, offset after)."""
    ln = u16(d, o)
    return d[o + 2:o + 2 + ln].decode('latin1', 'replace'), o + 2 + ln

def tdt(x):
    """Delphi TDateTime (days since 1899-12-30) to text."""
    if not x or x != x or x < 1 or x > 100000:
        return None
    return (datetime.datetime(1899, 12, 30) + datetime.timedelta(days=x)).strftime('%Y-%m-%d %H:%M:%S')

def pack_name(s, width=32):
    b = s.encode('latin1', 'replace')[:width - 1]
    return bytes([len(b)]) + b + b'\x00' * (width - 1 - len(b))

# ----------------------------------------------------------------------------- vocab

KIND = {1: 'input', 5: 'aux', 6: 'group', 7: 'bus leg (R/C of stereo/LCR bus)', 8: 'monitoring',
        9: 'talkback', 10: 'control group', 11: 'solo', 12: 'talkback in', 14: 'fx unit',
        15: 'matrix in', 16: 'matrix out', 17: 'graphic eq', 18: 'kind 18 (?)'}

def kind_name(k):
    if 27 <= k <= 36:
        return 'input port'
    if 77 <= k <= 86:
        return 'output port'
    return KIND.get(k, f'kind {k}')

FORMAT = {1: 'mono', 2: 'stereo', 3: 'LCR', 4: 'LCRS (?)'}

COMP = {1: 'input stage', 2: 'aux sends', 3: 'group routing', 4: 'eq', 5: 'multiband comp / de-esser',
        6: 'type 6 (?)', 7: 'hpf/lpf', 8: 'dynamics x2', 9: 'type 9 (?)', 10: 'empty', 11: 'bus input',
        12: 'output: fader, mute, pan (?)', 13: 'type 13 (delay?)', 14: 'output patch (?)',
        15: 'graphic eq', 16: 'control group fader', 17: 'input port', 18: 'output port',
        19: 'pan / lcr (?)', 21: 'fx unit', 23: 'solo (?)', 24: 'monitoring (?)', 33: 'talkback (?)'}

COMP_MARK = b'\xda\x00\x3a\x00'

# ----------------------------------------------------------------------------- records

def parse_component(d, o):
    """One component record. Layout (offsets from the da 00 3a 00 marker):
       +4 u32 type, +8 name[32], +40 f64 timestamp, +48 u32 nparams, +52 u8, +53 u32, +57 u8, +58 u32,
       +62 nparams x 8 bytes (param id, type, index, flag, 4-byte value), then i32 ref_a, i32 ref_b, u32 0
       (the references are -1 when unused)."""
    if d[o:o + 4] != COMP_MARK:
        raise ValueError(f'no component marker at 0x{o:x}')
    typ = u32(d, o + 4)
    n = u32(d, o + 48)
    c = {'off': o, 'type': typ, 'name': pstr(d, o + 8, 32), 'ts': f64(d, o + 40),
         'f1': d[o + 52], 'f2': u32(d, o + 53), 'f3': d[o + 57], 'f4': u32(d, o + 58)}
    p = o + 62
    params = []
    for _ in range(n):
        if d[p + 1] != typ:
            raise ValueError(f'param/type mismatch at 0x{p:x}')
        params.append((d[p], d[p + 2], d[p + 3], d[p + 4:p + 8]))
        p += 8
    # trailer: two signed reference fields (either may be -1) and a zero word
    c['params'] = params
    c['ref_a'] = i32(d, p)
    c['ref'] = i32(d, p + 4)
    if u32(d, p + 8) != 0:
        raise ValueError(f'unexpected component trailer at 0x{p:x}')
    c['end'] = p + 12
    return c, p + 12

def parse_footer(d, o):
    """Object footer: 27 00, u8 index, u8 kind, name[32], i32 ref, u8 format."""
    if d[o:o + 2] != b'\x27\x00':
        raise ValueError(f'no object footer at 0x{o:x}')
    return {'off': o, 'idx': d[o + 2], 'kind': d[o + 3], 'name': pstr(d, o + 4, 32),
            'ref': i32(d, o + 36), 'fmt': d[o + 40]}, o + 41

def param(c, pid, idx=0):
    for p, i, fl, raw in c['params']:
        if p == pid and i == idx:
            return raw
    return None

def pf(c, pid, idx=0):
    raw = param(c, pid, idx)
    return None if raw is None else struct.unpack('<f', raw)[0]

def pi(c, pid, idx=0):
    raw = param(c, pid, idx)
    return None if raw is None else struct.unpack('<I', raw)[0]

# ----------------------------------------------------------------------------- session

class Session:
    def __init__(self, data):
        self.d = d = data
        self.magic = d[:26]
        if not self.magic.startswith(b'DiGiCo'):
            raise ValueError('not a DiGiCo .ses file')
        self.model = d[11:15].decode('latin1').strip()
        self.format_tag = d[20:22].decode('latin1')
        self.version = u16(d, 0x22)          # software version that wrote the file (header.md)
        first = u16(d, 0x20)                 # offset of section 0; the offset table starts with it
        self.table_off = next((t for t in (0x100, 0x80) if first and u32(d, t) == first), None)
        if self.table_off is None:
            raise ValueError(f'no section offset table found (first section at 0x{first:x})')
        offs = []
        o = self.table_off
        while u32(d, o):
            offs.append(u32(d, o))
            o += 4
        self.offs = offs
        # one type byte per section after section 0, at table + 0xa1
        self.types = list(d[self.table_off + 0xa1:self.table_off + 0xa1 + len(offs) - 2])
        self.by_type = {}
        for i, t in enumerate(self.types):
            self.by_type.setdefault(t, i + 1)
        self.header_words = [u16(d, i) for i in range(0x1a, self.table_off, 2)]
        self.sample_rate = f32(d, 0x77) if self.table_off == 0x100 else f32(d, 0x5f)
        self.warnings = []
        self.parse_all()

    def sec(self, t):
        """Section bounds by listed type byte (int) or by index for section 0."""
        i = t if t == 0 else self.by_type.get(t)
        if i is None:
            raise KeyError(f'no section of type 0x{t:02x} in this file')
        return self.offs[i], self.offs[i + 1]

    # -- section 0: session name
    def parse_name(self):
        s, _ = self.sec(0)
        self.name, _ = wstr(self.d, s + 2)

    # -- section 6: live state (objects with inline components)
    def parse_live(self):
        d = self.d
        s, e = self.sec(0xd3)
        assert d[s:s + 2] == b'\xd3\x00'
        nobj = u32(d, s + 2)
        p = s + 6
        objs = []
        for k in range(nobj):
            assert d[p:p + 5] == b'\xd5\x00\x01\x00\x01', hex(p)
            n = u32(d, p + 5)
            p += 9
            comps = []
            for _ in range(n):
                c, p = parse_component(d, p)
                comps.append(c)
            foot, p = parse_footer(d, p)
            foot['k'] = k
            foot['comps'] = comps
            objs.append(foot)
        self.live = objs
        self.live_end = p

    # -- section 5: snapshots: flat component list, then one table + trailer per snapshot
    def parse_snapshots(self):
        d = self.d
        s, e = self.sec(0xd2)
        assert d[s:s + 2] == b'\xd2\x00'
        ncomp = u32(d, s + 4)
        p = s + 8
        flat = []
        for _ in range(ncomp):
            c, p = parse_component(d, p)
            flat.append(c)
        self.flat = flat
        self.flat_end = p
        self.snapshot_list_label = pstr(d, p + 10, 32)
        tables = [m.start() + s for m in
                  re.finditer(rb'\xd3\x00(.{4})\xd5\x00\x01\x00\x00', d[s:e], re.S)]
        tables = [t for t in tables if t >= p]
        self.snapshot_count = u32(d, tables[0] - 4) if tables else 0
        snaps = []
        for i, t in enumerate(tables):
            nobj = u32(d, t + 2)
            q = t + 6
            objs = []
            for k in range(nobj):
                assert d[q:q + 5] == b'\xd5\x00\x01\x00\x00', hex(q)
                n = u32(d, q + 5)
                refs = [u32(d, q + 9 + 4 * j) for j in range(n)]
                q += 9 + 4 * n
                foot, q = parse_footer(d, q)
                foot['k'] = k
                foot['refs'] = refs
                objs.append(foot)
            name, q2 = wstr(d, q)
            ts = f64(d, q2)
            w = u16(d, q2 + 8)
            nxt = tables[i + 1] if i + 1 < len(tables) else e
            snaps.append({'n': i + 1, 'table': t, 'name': name, 'ts': ts, 'w': w,
                          'trailer': (q2 + 10, nxt), 'objs': objs})
        self.snapshots = snaps

    # -- section 1: preset library
    def parse_presets(self):
        """Preset entry: d7 00, u32 nobj, nobj x object (d5 00 01 00 01, u32 n, n components, footer),
        then u16-length name, category and sub-label strings, u16 0x000e, f64 timestamp, 6 bytes.
        Stereo / LCR presets carry one object per leg."""
        d = self.d
        s, e = self.sec(0xdb)
        assert d[s:s + 2] == b'\xdb\x00'
        count = u32(d, s + 2)
        p = s + 6
        presets = []
        for _ in range(count):
            if d[p:p + 2] != b'\xd7\x00':
                break
            nobj = u32(d, p + 2)
            p += 6
            objs = []
            for _ in range(nobj):
                assert d[p:p + 5] == b'\xd5\x00\x01\x00\x01', hex(p)
                n = u32(d, p + 5)
                p += 9
                comps = []
                for _ in range(n):
                    c, p = parse_component(d, p)
                    comps.append(c)
                foot, p = parse_footer(d, p)
                foot['comps'] = comps
                objs.append(foot)
            pname, p = wstr(d, p)
            cat, p = wstr(d, p)
            sub, p = wstr(d, p)     # third label, usually empty (a performer name was seen)
            ts = f64(d, p + 2)      # u16 0x000e, f64 timestamp, 6 bytes
            p += 16
            presets.append({'name': pname, 'category': cat, 'sub': sub,
                            'kind': objs[0]['kind'] if objs else None,
                            'fmt': objs[0]['fmt'] if objs else None, 'ts': ts, 'objs': objs})
        self.presets = presets

    # -- section 4: I/O panel names (8-channel socket groups)
    def parse_panels(self):
        d = self.d
        s, e = self.sec(0xc9)
        ln = u32(d, s + 2)
        txt = d[s + 6:s + 6 + ln].decode('latin1', 'replace')
        self.panels = txt.split('\r\n')

    # -- section 7: fader banks (361-byte records)
    def parse_banks(self):
        d = self.d
        s, e = self.sec(0xf3)
        count = u32(d, s + 2)
        p = s + 6
        banks = []
        for _ in range(count):
            reclen = u16(d, p)
            idx = u16(d, p + 2)
            name = pstr(d, p + 4, 16)
            faders = [(d[p + 35 + 2 * j], d[p + 36 + 2 * j]) for j in range(12)]
            label = pstr(d, p + 311, 16)
            rgb = d[p + 327:p + 330].hex()
            banks.append({'idx': idx, 'name': name, 'faders': faders, 'label': label, 'rgb': rgb})
            p += reclen
        self.banks = banks

    # -- section 17: macros
    def parse_macros(self):
        """Macro: u16 index, name[32], u8 page, u8 slot, rgb[3], 00, u32 n1, n1 x (u16 len, data),
        u32 n2, n2 x (u16 len, data). List 1 holds the button's actions (20-byte records seen);
        list 2 is usually empty (14-byte record seen on 'Global Tap Tempo')."""
        d = self.d
        s, e = self.sec(0xf8)
        count = u32(d, s + 2)
        p = s + 6
        macros = []

        def reclist(p):
            n = u32(d, p)
            p += 4
            items = []
            for _ in range(min(n, 4096)):
                ln = u16(d, p)
                if ln < 2 or p + ln > e:
                    raise ValueError(f'bad macro record at 0x{p:x}')
                items.append(d[p + 2:p + ln].hex())
                p += ln
            return items, p

        for _ in range(count):
            if p + 44 > e:
                break
            idx = u16(d, p)
            name = pstr(d, p + 2, 32)
            page, slot = d[p + 34], d[p + 35]
            rgb = d[p + 36:p + 39].hex()
            actions, p = reclist(p + 40)
            extra = []
            if self.version >= 1926:          # the trigger list arrived with V1926 (macros.md)
                extra, p = reclist(p)
            macros.append({'idx': idx, 'page': page, 'slot': slot, 'name': name, 'rgb': rgb,
                           'actions': actions, 'extra': extra})
        self.macros = macros

    # -- sections 18 / 19 / 20
    def parse_misc(self):
        d = self.d
        s, e = self.sec(0xf9)
        self.sets = [{'name': pstr(d, s + 2 + 20 * j, 16), 'rgb': d[s + 18 + 20 * j:s + 21 + 20 * j].hex()}
                     for j in range((e - s - 2) // 20)]
        s, e = self.sec(0xfa)
        self.abc = [pstr(d, s + 2 + 19 * j, 16) for j in range((e - s - 2) // 19)]
        s, e = self.sec(0xeb)
        self.notes = d[s + 2:e].decode('latin1', 'replace')

    def parse_all(self):
        defaults = {'name': '', 'live': [], 'flat': [], 'snapshots': [], 'snapshot_list_label': '',
                    'snapshot_count': 0, 'presets': [], 'panels': [], 'banks': [], 'macros': [],
                    'sets': [], 'abc': [], 'notes': ''}
        for k, v in defaults.items():
            setattr(self, k, v)
        for step in (self.parse_name, self.parse_live, self.parse_snapshots, self.parse_presets,
                     self.parse_panels, self.parse_banks, self.parse_macros, self.parse_misc):
            try:
                step()
            except (AssertionError, ValueError, KeyError, IndexError, struct.error) as e:
                self.warnings.append(f'{step.__name__}: {type(e).__name__}: {e}')
        if not self.live:
            raise ValueError('live state did not parse: ' + '; '.join(self.warnings))
        self.saved = max([c['ts'] for o in self.live for c in o['comps']] or [0])

    # ------------------------------------------------------------------ convenience views

    def by_kind(self, *kinds):
        return [o for o in self.live if o['kind'] in kinds]

    def comp(self, obj, typ):
        for c in obj['comps']:
            if c['type'] == typ:
                return c
        return None

    def channel_row(self, o):
        """Headline values for a channel-like object (inputs, auxes, groups, matrix outs, CGs)."""
        out = self.comp(o, 12) or self.comp(o, 16)
        row = {'k': o['k'], 'kind': kind_name(o['kind']), 'name': o['name'],
               'format': FORMAT.get(o['fmt'], o['fmt']),
               'fader_dB': None, 'mute': None, 'hpf_Hz': None, 'lpf_Hz': None,
               'patch_main': None, 'patch_alt': None, 'sends_on': None}
        if out:
            row['fader_dB'] = round(pf(out, 0x21) or 0.0, 2)
            m = pf(out, 0x22)
            row['mute'] = None if m is None else (m != 0)
        flt = self.comp(o, 7)
        if flt:
            if (pf(flt, 0x03, 1) or 0) != 0:
                row['hpf_Hz'] = round(pf(flt, 0x05, 1) or 0)
            if (pf(flt, 0x03, 0) or 0) != 0:
                row['lpf_Hz'] = round(pf(flt, 0x05, 0) or 0)
        inp = self.comp(o, 1)
        if inp:
            row['patch_main'] = self.patch_name(param(inp, 0x00, 0))
            row['patch_alt'] = self.patch_name(param(inp, 0x00, 1))
        snd = self.comp(o, 2)
        if snd:
            on = [i for p, i, fl, raw in snd['params'] if p == 0x02 and struct.unpack('<f', raw)[0] != 0]
            row['sends_on'] = len(on)
        return row

    def channel_detail(self, o):
        """What the signal-flow view needs: trim, filters, EQ bands, dynamics, sends, group routing.
        Raw floats, no rounding, so the browser decoder can be held to the same numbers."""
        det = {'trim_dB': None, 'hpf': None, 'lpf': None, 'eq': [], 'dyn': [], 'sends': [], 'groups': []}
        inp = self.comp(o, 1)
        if inp:
            det['trim_dB'] = pf(inp, 0x01, 0)
        flt = self.comp(o, 7)
        if flt:
            det['lpf'] = {'on': (pf(flt, 0x03, 0) or 0) != 0, 'hz': pf(flt, 0x05, 0)}
            det['hpf'] = {'on': (pf(flt, 0x03, 1) or 0) != 0, 'hz': pf(flt, 0x05, 1)}
        eq = self.comp(o, 4)
        if eq:
            bands = sorted({i for pid, i, fl, raw in eq['params'] if pid == 0x05})
            det['eq'] = [{'band': b, 'on': (pf(eq, 0x04, b) or 0) != 0, 'hz': pf(eq, 0x05, b),
                          'q': pf(eq, 0x06, b), 'gain_dB': pf(eq, 0x07, b)} for b in bands]
        dyn = self.comp(o, 8)
        if dyn:
            mods = sorted({i for pid, i, fl, raw in dyn['params'] if pid == 0x01})
            det['dyn'] = [{'module': m, 'thr_dB': pf(dyn, 0x01, m), 'ratio': pf(dyn, 0xe1, m),
                           'on': (pf(dyn, 0xe9, m) or 0) != 0} for m in mods]
        snd = self.comp(o, 2)
        if snd:
            auxes = sorted({i for pid, i, fl, raw in snd['params'] if pid == 0x01})
            det['sends'] = [{'aux': a, 'dB': pf(snd, 0x01, a), 'on': (pf(snd, 0x02, a) or 0) != 0,
                             'pre': (pf(snd, 0x04, a) or 0) != 0} for a in auxes]
        grp = self.comp(o, 3)
        if grp:
            det['groups'] = sorted(i for pid, i, fl, raw in grp['params'] if pid == 0x09 and struct.unpack('<f', raw)[0] != 0)
        return det

    def patch_name(self, raw):
        """Input patch value: bytes 00 00 <socket index> <port kind>. Resolves to 'group/socket name'."""
        if raw is None:
            return None
        if raw == b'\x00\x00\x00\x00':
            return '-'
        idx, kind = raw[2], raw[3]
        for o in self.live:
            if o['kind'] == kind and o['idx'] == idx:
                return f"{kind_name(kind)}{kind}:{idx + 1} {o['name']}".strip()
        return f'kind{kind}:{idx + 1}'

    def resolve(self, ch, kind):
        """Fader bank entry (u8 index, u8 kind) to an object name."""
        if kind == 0:
            return '-'
        for o in self.live:
            if o['kind'] == kind and o['idx'] == ch:
                return o['name']
        return f'{kind_name(kind)} {ch}'

    # ------------------------------------------------------------------ scrubbing

    def scrub(self):
        """Replace every name from the file with a neutral label so outputs can be published.
        Objects become `IN 01`, `AUX 01`, `GRP 01` ...; sockets `IN29 01` / `OUT79 01`; snapshots
        `Snap 01`; macros `Macro 01`; banks `Bank 01`; presets `Preset 001`; categories `Cat 1`.
        Panel names and the default `Set` / `A1` labels are left as they are: they name equipment
        and pages, not people or shows. Read the output anyway before committing it."""
        abbr = {1: 'IN', 5: 'AUX', 6: 'GRP', 7: 'LEG', 8: 'MON', 9: 'TB', 10: 'CG', 11: 'SOLO', 12: 'TBIN',
                14: 'FX', 15: 'MTXIN', 16: 'MTX', 17: 'GEQ', 18: 'K18'}

        def label(kind, idx):
            if 27 <= kind <= 36:
                return f'IN{kind} {idx + 1:02d}'
            if 77 <= kind <= 86:
                return f'OUT{kind} {idx + 1:02d}'
            return f'{abbr.get(kind, "K" + str(kind))} {idx + 1:02d}'

        self.name = 'Session'
        self.snapshot_list_label = ''
        self.notes = ''
        for o in self.live:
            o['name'] = label(o['kind'], o['idx'])
            for c in o['comps']:
                c['name'] = o['name']
        # pool components take the label of the first snapshot object that points at them
        for c in self.flat:
            c['name'] = 'pool'
        for sn in self.snapshots:
            for so in sn['objs']:
                so['name'] = label(so['kind'], so['idx'])
                for r in so['refs']:
                    if r < len(self.flat):
                        self.flat[r]['name'] = so['name']
        for sn in self.snapshots:
            sn['name'] = f"Snap {sn['n']:02d}"
        cats = {}
        for i, p in enumerate(self.presets):
            p['name'] = f'Preset {i + 1:03d}'
            p['category'] = cats.setdefault(p['category'], f'Cat {len(cats) + 1}')
            p['sub'] = ''
            for o in p['objs']:
                o['name'] = f"{abbr.get(o['kind'], 'K' + str(o['kind']))} preset"
                for c in o['comps']:
                    c['name'] = o['name']
        for b in self.banks:
            b['name'] = f"Bank {b['idx'] + 1:02d}"
            b['label'] = ''
        for i, m in enumerate(self.macros):
            m['name'] = f"Macro {m['idx']:02d}"
        self.scrubbed = True

    # ------------------------------------------------------------------ outputs

    def summary(self):
        L = []
        w = L.append
        w(f'Session       : {self.name!r}   console {self.model}   format {self.format_tag}   V{self.version}   '
          f'{len(self.d):,} bytes   sample rate {self.sample_rate:g}'
          + ('   [names scrubbed]' if getattr(self, 'scrubbed', False) else ''))
        w(f'Last saved    : {tdt(self.saved)}   (newest component timestamp)')
        for wmsg in self.warnings:
            w(f'WARNING       : {wmsg}')
        w(f'Objects       : {len(self.live)} live objects, {len(self.flat)} snapshot components, '
          f'{len(self.snapshots)} snapshots, {len(self.presets)} presets, {len(self.banks)} fader banks, '
          f'{len(self.macros)} macros')
        counts = {}
        for o in self.live:
            counts[kind_name(o['kind'])] = counts.get(kind_name(o['kind']), 0) + 1
        w('Object kinds  : ' + ', '.join(f'{v} {k}' for k, v in counts.items()))
        w('')
        w('INPUT CHANNELS (fader/mute/HPF/LPF/patch raw/active sends)')
        for o in self.by_kind(1):
            r = self.channel_row(o)
            w(f"  {o['k'] + 1:3d} {o['name']:<20} {r['format']:<7} {r['fader_dB']:>7} dB  "
              f"{'MUTE' if r['mute'] else '    '}  hpf {str(r['hpf_Hz'] or '-'):>5}  lpf {str(r['lpf_Hz'] or '-'):>5}  "
              f"patch {r['patch_main']}/{r['patch_alt']}  sends {r['sends_on']}")
        for kind, title in ((5, 'AUX BUSSES'), (6, 'GROUPS'), (16, 'MATRIX OUTPUTS'), (15, 'MATRIX INPUTS'),
                            (10, 'CONTROL GROUPS'), (14, 'FX UNITS'), (17, 'GRAPHIC EQs'), (11, 'SOLOS'),
                            (8, 'MONITORING'), (9, 'TALKBACK'), (12, 'TALKBACK IN'), (18, 'KIND 18')):
            objs = self.by_kind(kind)
            if not objs:
                continue
            w('')
            w(title)
            if kind in (14, 17):
                w('  ' + ', '.join(o['name'] for o in objs))
                continue
            for o in objs:
                r = self.channel_row(o)
                fl = f"{r['fader_dB']:>7} dB  {'MUTE' if r['mute'] else '    '}" if r['fader_dB'] is not None else ''
                w(f"  {o['k']:4d} {o['name']:<20} {r['format']:<7} {fl}")
        w('')
        w('I/O PORTS (name lists per port group; blank = unnamed)')
        for grp in sorted({o['kind'] for o in self.live if 27 <= o['kind'] <= 36 or 77 <= o['kind'] <= 86}):
            objs = [o for o in self.live if o['kind'] == grp]
            named = [o['name'] for o in objs if o['name']]
            w(f"  {kind_name(grp)} group {grp}: {len(objs)} sockets, {len(named)} named: "
              + ', '.join(named[:12]) + (' ...' if len(named) > 12 else ''))
        w('')
        w('I/O PANEL NAMES: ' + ', '.join(p for p in self.panels if p))
        w('')
        w('FADER BANKS (12 faders each)')
        for b in self.banks:
            w(f"  {b['idx']:2d} {b['name']:<16} [{b['label']}] rgb {b['rgb']}: "
              + ', '.join(self.resolve(ch, k) for ch, k in b['faders']))
        w('')
        w('MACROS (index, page, slot, colour, name, action records as hex)')
        for m in self.macros:
            w(f"  {m['idx']:3d} page {m['page']:3d} slot {m['slot']:3d} #{m['rgb']} {m['name']:<24} "
              f"{len(m['actions'])} action(s): " + ' | '.join(m['actions'][:4])
              + (' ...' if len(m['actions']) > 4 else '') + (f"  extra: {m['extra']}" if m['extra'] else ''))
        w('')
        w(f'SNAPSHOTS (list label {self.snapshot_list_label!r}, count field {self.snapshot_count})')
        for sn in self.snapshots:
            w(f"  {sn['n']:3d} {sn['name']:<28} saved {tdt(sn['ts'])}  objects {len(sn['objs'])}")
        w('')
        cats = {}
        for p in self.presets:
            cats[p['category']] = cats.get(p['category'], 0) + 1
        w('PRESET LIBRARY: ' + ', '.join(f'{v} x {k!r}' for k, v in cats.items()))
        w('  ' + ', '.join(f"{p['name']} ({p['category']})" for p in self.presets[:60])
          + (' ...' if len(self.presets) > 60 else ''))
        w('')
        w('SETS: ' + ', '.join(f"{s['name']}#{s['rgb']}" for s in self.sets[:8]) + ' ...')
        w('A/B/C LABELS: ' + ', '.join(self.abc[:6]) + ' ...')
        w(f'NOTES: {len(self.notes)} chars, {self.notes.count(chr(10))} lines')
        return '\n'.join(L)

    def to_json(self):
        def comp_json(c):
            return {'type': c['type'], 'type_name': COMP.get(c['type'], '?'), 'name': c['name'],
                    'ts': tdt(c['ts']), 'f4': c['f4'], 'ref_a': c['ref_a'], 'ref_b': c['ref'],
                    'params': [{'id': p, 'idx': i, 'flag': fl, 'hex': raw.hex(),
                                'f32': struct.unpack('<f', raw)[0], 'i32': struct.unpack('<i', raw)[0]}
                               for p, i, fl, raw in c['params']]}
        return {
            'file': {'model': self.model, 'format_tag': self.format_tag, 'version': self.version, 'size': len(self.d),
                     'sample_rate': self.sample_rate, 'header_words': self.header_words,
                     'table_offset': self.table_off, 'section_offsets': self.offs, 'section_types': self.types},
            'warnings': self.warnings,
            'session_name': self.name,
            'saved': tdt(self.saved),
            'objects': [{'k': o['k'], 'idx': o['idx'], 'kind': o['kind'], 'kind_name': kind_name(o['kind']),
                         'name': o['name'], 'format': o['fmt'], 'ref': o['ref'],
                         'headline': self.channel_row(o),
                         'detail': self.channel_detail(o) if o['kind'] in (1, 5, 6, 7, 10, 15, 16) else None,
                         'components': [comp_json(c) for c in o['comps']]} for o in self.live],
            'snapshot_components': [{'type': c['type'], 'name': c['name'], 'ts': tdt(c['ts']), 'f4': c['f4'],
                                     'ref_a': c['ref_a'], 'ref_b': c['ref'],
                                     'params': ' '.join(f'{p:02x}.{i}.{fl}={raw.hex()}' for p, i, fl, raw in c['params'])}
                                    for c in self.flat],
            'snapshots': [{'n': s['n'], 'name': s['name'], 'saved': tdt(s['ts']), 'w': s['w'],
                           'objects': [{'k': o['k'], 'kind': o['kind'], 'name': o['name'], 'format': o['fmt'],
                                        'ref': o['ref'], 'component_refs': o['refs']} for o in s['objs']]}
                          for s in self.snapshots],
            'presets': [{'name': p['name'], 'category': p['category'], 'sub': p['sub'], 'kind': kind_name(p['kind']),
                         'format': p['fmt'], 'saved': tdt(p['ts']),
                         'objects': [{'name': o['name'], 'kind': o['kind'], 'format': o['fmt'],
                                      'components': [comp_json(c) for c in o['comps']]} for o in p['objs']]}
                        for p in self.presets],
            'panels': self.panels,
            'fader_banks': [{'idx': b['idx'], 'name': b['name'], 'label': b['label'], 'rgb': b['rgb'],
                             'faders': [{'ch': ch, 'kind': k, 'name': self.resolve(ch, k)} for ch, k in b['faders']]}
                            for b in self.banks],
            'macros': self.macros,
            'sets': self.sets, 'abc_labels': self.abc, 'notes': self.notes,
        }

    def to_csv(self, path):
        with open(path, 'w', newline='') as f:
            wtr = csv.writer(f, lineterminator='\n')
            wtr.writerow(['index', 'kind', 'name', 'format', 'fader_dB', 'mute', 'hpf_Hz', 'lpf_Hz',
                          'patch_main', 'patch_alt', 'sends_on'])
            for o in self.live:
                if o['kind'] in (1, 5, 6, 10, 15, 16):
                    r = self.channel_row(o)
                    wtr.writerow([o['k'], r['kind'], o['name'], r['format'], r['fader_dB'], r['mute'],
                                  r['hpf_Hz'], r['lpf_Hz'], r['patch_main'], r['patch_alt'], r['sends_on']])

    # ------------------------------------------------------------------ experimental writer

    def rename(self, old, new, kind=None):
        """Rewrite every stored copy of an object's name (live components + footer, and the
        snapshot components the snapshot tables point at for the same object). Fixed-width
        fields only, so the file layout does not change. Returns (new bytes, copies changed)."""
        d = bytearray(self.d)
        targets = [o for o in self.live if o['name'] == old and (kind is None or o['kind'] == kind)]
        if not targets:
            raise SystemExit(f'no live object named {old!r}')
        if len(targets) > 1 and kind is None:
            raise SystemExit(f'{len(targets)} objects named {old!r}: ' +
                             ', '.join(f"{kind_name(o['kind'])}[{o['idx']}]" for o in targets) +
                             ' -- pass --kind to pick one')
        o = targets[0]
        nb = pack_name(new)
        changed = 0
        spots = [c['off'] + 8 for c in o['comps']] + [o['off'] + 4]
        for sn in self.snapshots:
            for so in sn['objs']:
                if so['kind'] == o['kind'] and so['idx'] == o['idx'] and so['name'] == old:
                    spots.append(so['off'] + 4)
                    for r in so['refs']:
                        c = self.flat[r]
                        if c['name'] == old:
                            spots.append(c['off'] + 8)
        for sp in set(spots):
            d[sp:sp + 32] = nb
            changed += 1
        return bytes(d), changed

# ----------------------------------------------------------------------------- cli

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ses')
    ap.add_argument('--json')
    ap.add_argument('--csv')
    ap.add_argument('--rename', nargs=2, metavar=('OLD', 'NEW'))
    ap.add_argument('--kind', type=int, help='object kind for --rename (1 input, 5 aux, 6 group, 16 matrix out ...)')
    ap.add_argument('--out', help='output .ses for --rename (never overwrites the source)')
    ap.add_argument('--scrub', action='store_true', help='replace every name with a neutral label')
    a = ap.parse_args()
    with open(a.ses, 'rb') as f:
        ses = Session(f.read())
    if a.scrub:
        if a.rename:
            raise SystemExit('--scrub and --rename do not combine')
        ses.scrub()
    if a.rename:
        if not a.out or a.out == a.ses:
            raise SystemExit('--rename needs --out pointing at a new file')
        data, n = ses.rename(a.rename[0], a.rename[1], a.kind)
        with open(a.out, 'wb') as f:
            f.write(data)
        print(f'wrote {a.out}: {n} name copies rewritten ({a.rename[0]!r} -> {a.rename[1]!r}). '
              f'UNTESTED on a console: open it in the offline editor first.')
        return
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(ses.to_json(), f, indent=1)
        print(f'wrote {a.json}')
    if a.csv:
        ses.to_csv(a.csv)
        print(f'wrote {a.csv}')
    if not (a.json or a.csv):
        print(ses.summary())

if __name__ == '__main__':
    main()
