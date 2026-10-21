# skills.csv + template.html -> index.html（内蔵データ＝オフライン/ローカル用の予備）
# ※GitHub Pages では skills.csv を毎回読むので、CSV更新だけならこのビルドは不要
import pathlib, datetime, os
here = pathlib.Path(__file__).resolve().parent
root = here.parent if here.name == 'tools' else here
csv = (root/'skills.csv').read_text(encoding='utf-8-sig').strip()
built = datetime.datetime.fromtimestamp(os.path.getmtime(root/'skills.csv'), datetime.timezone.utc).isoformat()
tpl = (here/'template.html').read_text(encoding='utf-8')
(root/'index.html').write_text(tpl.replace('__BUILT_AT__', built).replace('__DATA__', csv), encoding='utf-8')
print('built', len(csv.splitlines())-1, 'skills ->', root/'index.html')
