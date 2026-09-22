import json, threading, unittest
from http.client import HTTPConnection
from unittest.mock import patch
import server

class Tests(unittest.TestCase):
    def test_catalog(self):
        self.assertEqual(len(server.CATALOG),340)
        self.assertEqual(len({d['id'] for d in server.CATALOG}),340)
    def test_reject_outside_catalog(self):
        row={'name':'테스트','strength':'','ingredient':'','notes':'','alternatives':[{'id':9999,'reason':'x'}]}
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
