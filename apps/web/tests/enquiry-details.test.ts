import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseEnquiryDetails,formatBudget,formatVisitDate,safeSourceUrl} from '../src/enquiry-details.js';
test('older collapsed WordPress enquiries display separate values',()=>{
 const fields=parseEnquiryDetails('Project: Example Residency Plot size: 125 Sq. Yards Budget: 800000 Preferred visit: 2026-11-17 Message: Please contact me Source page: https://example.test/projects/example/');
 assert.deepEqual(fields,{project:'Example Residency',plotSize:'125 Sq. Yards',budget:'800000',preferredVisit:'2026-11-17',message:'Please contact me',sourcePage:'https://example.test/projects/example/'});
 assert.equal(formatBudget(fields.budget!),'8,00,000');
 assert.equal(formatVisitDate(fields.preferredVisit!),'17 Nov 2026');
});
test('multiline and ordinary messages retain their text',()=>{
 const fields=parseEnquiryDetails('Project: Example\nMessage: My Budget: needs discussion\nPlease call later.\nSource page: https://example.test/');
 assert.equal(fields.message,'My Budget: needs discussion\nPlease call later.');
 assert.deepEqual(parseEnquiryDetails('Please call me tomorrow.'),{message:'Please call me tomorrow.'});
 assert.deepEqual(parseEnquiryDetails(null),{});
 assert.equal(formatBudget('80 lakh negotiable'),'80 lakh negotiable');
 assert.equal(formatVisitDate('2026-02-30'),'2026-02-30');
});
test('untrusted source URLs are never made executable links',()=>{
 assert.equal(safeSourceUrl('javascript:alert(1)'),undefined);
 assert.equal(safeSourceUrl('data:text/html,<script>alert(1)</script>'),undefined);
 assert.equal(safeSourceUrl('https://example.test/project'),'https://example.test/project');
 assert.equal(safeSourceUrl('https://user:secret@example.test/'),undefined);
});

test('Enquiry Pro displays interest separately without inventing a project',()=>{
 const details=parseEnquiryDetails('Interest: General Enquiry\nMessage: Please call me\nContact consent: Yes (enquiry response only)');
 assert.equal(details.interest,'General Enquiry');assert.equal(details.project,undefined);
 assert.equal(details.message,'Please call me\nContact consent: Yes (enquiry response only)');
});
