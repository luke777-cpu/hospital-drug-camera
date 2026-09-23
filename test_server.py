import json, threading, unittest
from http.client import HTTPConnection
from unittest.mock import patch
import server
import io
from urllib.error import HTTPError

class Tests(unittest.TestCase):
    def test_api_error_diagnostics(self):
        body={'error':{'code':'invalid_json_schema','type':'invalid_request_error','param':'text.format.schema','message':'PRIVATE-PHOTO-AND-KEY'}}
        e=HTTPError('',400,'bad',{},io.BytesIO(json.dumps(body).encode()))
        result=server.base.api_error(e)
        self.assertIn('HTTP 400',result);self.assertIn('invalid_json_schema',result)
        self.assertNotIn('PRIVATE',result)
        e=HTTPError('',503,'unavailable',{},io.BytesIO(b'not json'))
        self.assertIn('HTTP 503',server.base.api_error(e))
    def test_json_request_and_validation(self):
        row={'name':'테스트','strength':'20mg','ingredient':'','notes':'','family':'PPI','alternatives':[]}
        def response(value):
            return io.BytesIO(json.dumps({'status':'completed','output':[{'content':[{'type':'output_text','text':json.dumps(value)}]}]}).encode())
        with patch.object(server.base,'validate',return_value=('test',[],None)), patch.object(server,'urlopen',return_value=response({'drugs':[row]})) as call:
            self.assertEqual(server.generate({},'TEST')['drugs'][0]['family'],'PPI')
            payload=json.loads(call.call_args.args[0].data)
            self.assertEqual(payload['text']['format'],{'type':'json_object'})
            self.assertIn('JSON',payload['instructions'])
            self.assertIn('JSON',payload['input'][0]['content'][0]['text'])
            self.assertFalse(payload['store'])
        for invalid in ['outside-family',None,123]:
            with self.assertRaises(ValueError):server.clean_result({'drugs':[{**row,'family':invalid}]})
        with patch.object(server.base,'validate',return_value=('test',[],None)), patch.object(server,'urlopen',return_value=response({'drugs':[{**row,'family':'outside-family'}]})):
            with self.assertRaises(ValueError):server.generate({},'TEST')
    def test_compact_catalog_preserves_all_drugs(self):
        rows=[(family,name,ingredient) for family,drugs in server.compact_catalog().items() for name,ingredient in drugs]
        self.assertEqual(sorted(rows),sorted((d['family'],d['name'],d['ingredient']) for d in server.CATALOG))

    def test_catalog(self):
        self.assertEqual(len(server.CATALOG),340)
        self.assertEqual(len({d['id'] for d in server.CATALOG}),340)
    def test_reject_outside_catalog(self):
        row={'name':'테스트','strength':'','ingredient':'','notes':'','family':'','alternatives':[{'id':9999,'reason':'x'}]}
        with self.assertRaises(ValueError):server.clean_result({'drugs':[row]})
        row['alternatives']=[{'id':1,'reason':'검토'}]
        self.assertEqual(server.clean_result({'drugs':[row]})['drugs'][0]['alternatives'][0]['id'],1)
    def test_preserve_salts_and_doses(self):
        self.assertNotEqual(server.norm('성분나트륨 10mg'),server.norm('성분 10mg'))
        self.assertNotEqual(server.norm('성분 10mg'),server.norm('성분 20mg'))
    def test_phone_flow(self):
        app=server.base.make_server('TEST-NOT-A-KEY',0);app.lan=True
        thread=threading.Thread(target=app.serve_forever,daemon=True);thread.start()
        c=HTTPConnection(app.address);origin='http://'+app.address
        try:
            c.request('GET','/');r=c.getresponse();html=r.read().decode()
            self.assertEqual(r.getheader('Referrer-Policy'),'same-origin');self.assertNotIn(app.token,html)
            c.request('POST','/pair','code='+app.pair_code,{'Origin':origin,'Content-Type':'application/x-www-form-urlencoded'})
            r=c.getresponse();r.read();self.assertEqual(r.status,303);cookie=r.getheader('Set-Cookie').split(';')[0]
            c.request('GET','/',headers={'Cookie':cookie});r=c.getresponse();html=r.read().decode()
            self.assertIn('본원 대체약 찾기',html);self.assertIn(app.token,html);self.assertNotIn('TEST-NOT-A-KEY',html)
            c.request('GET','/catalog',headers={'Cookie':cookie});r=c.getresponse();self.assertEqual(len(json.loads(r.read())['drugs']),340)
            headers={'Cookie':cookie,'Origin':origin,'Content-Type':'application/json','X-Session-Token':app.token}
            with patch.object(server.base,'generate',return_value={'drugs':[]}):
                c.request('POST','/generate',json.dumps({'history':'가상 약'}).encode(),headers)
                r=c.getresponse();self.assertEqual(r.status,200);self.assertEqual(json.loads(r.read()),{'drugs':[]})
            headers['Origin']='http://other.example'
            c.request('POST','/generate',b'{}',headers);r=c.getresponse();r.read();self.assertEqual(r.status,403)
        finally:c.close();app.shutdown();app.server_close();thread.join()
if __name__=='__main__':unittest.main()
