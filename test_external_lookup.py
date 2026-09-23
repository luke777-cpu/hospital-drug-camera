import copy, json, unittest
from unittest.mock import patch
from urllib.error import HTTPError
import external_lookup as e

URL='https://www.health.kr/searchDrug/result_drug.asp?drug_cd=TEST'
ROW={'index':0,'status':'found','matched_name':'테스트정20밀리그램','ingredient':'가상성분','broad_class':'혈압약','detail_class':'가상 세부계열','purpose':'테스트용 요약','route':'oral','urls':[URL]}
CAT=[{'id':1,'name':'본원 가상정','ingredient':'가상성분2','sheet':'경구약품','family':'가상 계열'}, {'id':2,'name':'본원 가상주','ingredient':'가상성분2','sheet':'주사','family':'가상 계열'}]
Q={'queries':[{'name':'테스트정20mg','strength':'20mg'}],'history':'DO-NOT-SEND','photos':['DO-NOT-SEND']}
def response(rows,search=False):
    items=[{'type':'message','content':[{'type':'output_text','text':json.dumps({'drugs':rows})}]}]
    if search:items.insert(0,{'type':'web_search_call','status':'completed','action':{'sources':[{'url':URL}]}})
    return {'status':'completed','output':items}
class Tests(unittest.TestCase):
    def test_success_privacy_and_route(self):
        compare=response([{'index':0,'candidates':[{'id':1,'reason':'공통 계열'},{'id':2,'reason':'경로 다름'}]}])
        with patch.object(e,'request',side_effect=[response([ROW],True),compare]) as req:
            r=e.lookup(Q,'TEST','gpt-4.1',CAT)['drugs'][0]
            self.assertEqual(r['lookup_status'],'found');self.assertEqual(r['sources'],[URL])
            self.assertEqual([x['id'] for x in r['external_candidates']],[1])
            first=req.call_args_list[0].args[0]
            self.assertEqual(first['tool_choice'],'required')
            self.assertEqual(first['tools'][0]['filters']['allowed_domains'],e.DOMAINS)
            for call in req.call_args_list:
                self.assertNotIn('DO-NOT-SEND',json.dumps(call.args[0]));self.assertFalse(call.args[0]['store'])
    def test_fabricated_sources_names_and_no_search(self):
        cases=[({**ROW,'urls':['https://health.kr.evil.test/x']},True),({**ROW,'urls':['https://health.kr/not-retrieved']},True),({**ROW,'matched_name':'다른정'},True),(ROW,False),({**ROW,'status':'ambiguous'},True)]
        for row,search in cases:
            with self.subTest(row=row),patch.object(e,'request',return_value=response([row],search)) as req:
                r=e.lookup(Q,'TEST','gpt-4.1',CAT)['drugs'][0]
                self.assertNotEqual(r['lookup_status'],'found');self.assertEqual(r['external_candidates'],[]);self.assertEqual(req.call_count,1)
    def test_comparison_failure_keeps_lookup(self):
        for fail in [HTTPError('',429,'rate',{},None),response([{'index':0,'candidates':[{'id':999,'reason':'invented'}]}])]:
            with patch.object(e,'request',side_effect=[response([ROW],True),fail]):
                r=e.lookup(Q,'TEST','gpt-4.1',CAT)['drugs'][0]
                self.assertEqual(r['ingredient'],'가상성분');self.assertEqual(r['lookup_status'],'found')
                self.assertEqual(r['external_candidates'],[]);self.assertIn('candidate_error',r)
    def test_no_sources_does_not_compare(self):
        with patch.object(e,'request',return_value=response([{**ROW,'urls':[]}],True)) as req:
            self.assertNotEqual(e.lookup(Q,'TEST','gpt-4.1',CAT)['drugs'][0]['lookup_status'],'found');self.assertEqual(req.call_count,1)
    def test_unknown_route_and_invalid_input(self):
        with patch.object(e,'request',return_value=response([{**ROW,'route':'unknown'}],True)) as req:
            r=e.lookup(Q,'TEST','gpt-4.1',CAT)['drugs'][0]
            self.assertEqual(r['lookup_status'],'found');self.assertEqual(req.call_count,1)
        with patch.object(e,'request') as req:
            for data in [{'queries':[]},{'queries':[{'name':'900101-1234567'}]},{'queries':[{'name':'<script>'}]}]:
                with self.assertRaises(ValueError):e.lookup(data,'TEST','gpt-4.1',CAT)
            req.assert_not_called()
    def test_index_integrity(self):
        for rows in [[{**ROW,'index':4}],[ROW,ROW]]:
            with patch.object(e,'request',return_value=response(rows,True)):
                with self.assertRaises(ValueError):e.lookup(Q,'TEST','gpt-4.1',CAT)
if __name__=='__main__':unittest.main()
