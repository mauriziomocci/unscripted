import sys
s=open('shell.html').read()
for k,f in [('SIM','../sim.js'),('SCENE','scene.js'),('ENGINE','engine.js'),('UI','ui.js')]:
    s=s.replace(f'/*__{k}__*/', (open(f).read() if k != 'UI' else (lambda u: u[:u.rstrip().rfind('})();')] + open('funui.js').read() + '\n' + open('archpack.js').read() + '\n' + open('archui.js').read() + '\n' + open('archpack-futuro.js').read() + '\n' + open('archfuturo.js').read() + '\n' + open('llm.js').read() + '\n' + open('venture.js').read() + '\n' + open('venture-missions.js').read() + '\n' + open('ventureui.js').read() + '\n' + open('ventbridge.js').read() + '\n' + open('romanzo.js').read() + '\n' + open('romanzoui.js').read() + '\n' + open('report.js').read() + '\n' + open('talk.js').read() + '\n' + open('talkfun.js').read() + '\n})();\n')(open(f).read())))
s=s.replace('/*__STYLE__*/', open('style.js').read() + '\n' + open('qualita.js').read())
s=s.replace('/*__ENV__*/', open('env.js').read() + '\n' + open('features.js').read() + '\n' + open('fun.js').read())
open('live.html','w').write(s)
mock=open('mock.js').read() if len(sys.argv)>1 else ''
t=s.replace('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js','../three.min.js').replace('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js','../OrbitControls.js')
t=t.replace('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js','../jspdf.umd.min.js')
t=t.replace('<script src="../three.min.js"></script>','<script>'+mock+'</script><script src="../three.min.js"></script>')
open('test.html','w').write(t)
print(len(s))
