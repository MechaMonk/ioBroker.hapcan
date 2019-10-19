
iobrokerHapcanDir=/opt/iobroker/node_modules/iobroker.hapcan

cp io-package.json ${iobrokerHapcanDir}
cp package.json ${iobrokerHapcanDir}
cp package-lock.json ${iobrokerHapcanDir}
cp main.js ${iobrokerHapcanDir}
cp lib/async-lock.js ${iobrokerHapcanDir}/lib
cp lib/creator.js ${iobrokerHapcanDir}/lib
cp lib/decoder.js ${iobrokerHapcanDir}/lib
cp lib/encoder.js ${iobrokerHapcanDir}/lib
cp lib/listener.js ${iobrokerHapcanDir}/lib
cp lib/reader.js ${iobrokerHapcanDir}/lib
cp lib/tools.js ${iobrokerHapcanDir}/lib
cp lib/windows-1250.js ${iobrokerHapcanDir}/lib
cp admin/hapcan.png ${iobrokerHapcanDir}/admin
cp admin/index_m.html ${iobrokerHapcanDir}/admin
cp admin/words.js ${iobrokerHapcanDir}/admin

cd ${iobrokerHapcanDir}
iobroker upload hapcan
cd -

iobroker restart hapcan

#npm run test:package
#npm run test:unit
#npm run test:integration

