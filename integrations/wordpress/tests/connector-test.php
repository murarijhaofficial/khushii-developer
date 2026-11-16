<?php
// Lightweight WordPress stubs for connector behavior tests; not a replacement for a live WordPress test.
define('ABSPATH', __DIR__);
define('KHUSHII_CRM_API_URL', 'https://crm.example.test/api/v1');
define('KHUSHII_CRM_WEBHOOK_SECRET', 'test-secret-long-enough-for-tests');
$GLOBALS['meta'] = array(); $GLOBALS['events'] = array(); $GLOBALS['requests'] = array(); $GLOBALS['response_status'] = 202;
class WP_Error { public $code; public $data; public function __construct($code, $message = '', $data = null) { $this->code = $code; $this->data=$data; } public function get_error_data(){return $this->data;} }
function add_action(...$args) {$GLOBALS['hooks'][$args[0]][]=$args[1];} function add_filter(...$args) {}
function absint($v) { return abs((int)$v); }
function get_post_type($id) { if((int)$id===84)return 'khep_enquiry'; return 20 === (int)$id ? 'npp_project' : ((42 === (int)$id || ((int)$id>=1000 && (int)$id<=1122)) ? 'npp_lead' : ''); }
function get_post_status($id) { return 'private'; }
function get_post_meta($id,$key,$single=true) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function update_post_meta($id,$key,$val) { $GLOBALS['meta'][$id][$key] = $val; return true; }
function add_post_meta($id,$key,$val,$unique=false) { if ($unique && isset($GLOBALS['meta'][$id][$key])) return false; $GLOBALS['meta'][$id][$key]=$val; return true; }
function delete_post_meta($id,$key,$val='') { unset($GLOBALS['meta'][$id][$key]); return true; }
function wp_clear_scheduled_hook($hook,$args=array()){unset($GLOBALS['events'][$hook . ':' . ($args[0] ?? 'batch')]);}
function wp_next_scheduled($hook,$args) { return $GLOBALS['events'][$hook . ':' . ($args[0] ?? 'batch')] ?? false; }
function wp_schedule_single_event($time,$hook,$args,$error=false) { $GLOBALS['events'][$hook . ':' . ($args[0] ?? 'batch')]=$time; return true; }
function wp_http_validate_url($url) { return filter_var($url, FILTER_VALIDATE_URL); }
function wp_parse_url($url,$component=-1) { return parse_url($url,$component); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function is_email($value) { return filter_var($value,FILTER_VALIDATE_EMAIL); }
function wp_html_excerpt($text,$length,$more='') { return substr(strip_tags($text),0,$length); }
function esc_url_raw($url) { return $url; }
function get_post_field($field,$id) { return 'sample-project'; }
function home_url($path='/') { return 'https://example.test' . $path; }
function wp_json_encode($data) { return json_encode($data); }
function untrailingslashit($v) { return rtrim($v,'/'); }
function wp_safe_remote_post($url,$args) { $GLOBALS['requests'][]=array($url,$args); return array('status'=>$GLOBALS['response_status'],'body'=>'{"accepted":true,"id":"test-id"}'); }
function wp_remote_retrieve_response_code($r) { return $r['status']; }
function wp_remote_retrieve_body($r) { return $r['body']; }
function sanitize_text_field($v) { return $v; }
function check($value,$message) { if (!$value) { fwrite(STDERR,"FAILED: $message\n"); exit(1); } }
require getenv('CONNECTOR_FILE') ?: __DIR__ . '/../nestoria-crm-connector/nestoria-crm-connector.php';
check(khushii_npp_phone('98765 43210') === '+919876543210','Indian number normalization');
check(khushii_npp_phone('09876543210') === '+919876543210','Indian trunk prefix normalization');
check(khushii_npp_phone('+44 7700 900123') === '+447700900123','international number normalization');
check(khushii_npp_phone('1234567890') === '','ambiguous phone rejected');
$GLOBALS['meta'][42] = array('_npp_lead_name'=>'Example Visitor','_npp_lead_phone'=>'98765 43210','_npp_lead_email'=>'Not provided','_npp_lead_project'=>'Example Project','_npp_lead_plotsize'=>'125 Sq. Yards','_npp_lead_budget'=>'Example budget','_npp_lead_preferredsitevisit'=>'2027-01-01','_npp_lead_message'=>'Please call','_npp_lead_source_url'=>'https://example.test/project','_npp_lead_project_id'=>20);
khushii_npp_meta_saved(1,42,'_npp_lead_source_url','https://example.test/project');
check(get_post_meta(42,'_khushii_crm_status',true)==='queued','new enquiry queued');
unset($GLOBALS['events'][KHUSHII_NPP_CRON . ':42']);
$GLOBALS['response_status']=503; check(count($GLOBALS['hooks']['shutdown']??array())===1,'new enquiry schedules an immediate shutdown attempt'); foreach($GLOBALS['hooks']['shutdown'] as $callback){$callback();}
check(get_post_meta(42,'_khushii_crm_status',true)==='queued','failure queued for retry');
check(strpos(get_post_meta(42,'_khushii_crm_error',true),'HTTP 503')!==false,'safe delivery diagnostic recorded');
$first=$GLOBALS['requests'][0][1]; $payload=json_decode($first['body'],true);
check($payload['phone']==='+919876543210' && !isset($payload['email']),'phone and optional email mapping');
check(strpos($payload['message'],'Plot size: 125 Sq. Yards')!==false && strpos($payload['message'],'Budget: Example budget')!==false && strpos($payload['message'],'Preferred visit: 2027-01-01')!==false,'enquiry fields preserved');
check($payload['projectSlug']==='sample-project','project slug mapped');
check($first['headers']['X-CRM-Signature']==='sha256='.hash_hmac('sha256',$first['headers']['X-CRM-Timestamp'].'.'.$first['body'],KHUSHII_CRM_WEBHOOK_SECRET),'signature matches request body');
unset($GLOBALS['events'][KHUSHII_NPP_CRON . ':42']);
$GLOBALS['response_status']=202; khushii_npp_deliver(42);
$second=json_decode($GLOBALS['requests'][1][1]['body'],true);
check($payload['externalSubmissionId']===$second['externalSubmissionId'],'retries use stable id');
check(get_post_meta(42,'_khushii_crm_status',true)==='sent','successful delivery recorded');
check(!wp_next_scheduled(KHUSHII_NPP_CRON,array(42)),'successful immediate delivery cancels retry');
khushii_npp_deliver(42); check(count($GLOBALS['requests'])===2,'sent lead is not sent again');
$GLOBALS['options']=array();
function get_option($key,$default=false){return $GLOBALS['options'][$key]??$default;}
function update_option($key,$value,$autoload=null){$GLOBALS['options'][$key]=$value;return true;}
function wp_salt($scheme){return 'test-only-wordpress-auth-salt';}
class TestWpdb {
 public $posts='wp_posts';
 public function prepare($query,...$args){return (int)$args[count($args)-1];}
 public function get_col($cursor){return array_values(array_filter(range(1000,1122),function($id)use($cursor){return $id>$cursor;})) ? array_slice(array_values(array_filter(range(1000,1122),function($id)use($cursor){return $id>$cursor;})),0,50):array();}
}
$wpdb=new TestWpdb();
update_option('khushii_npp_import',array('cursor'=>0,'scanned'=>0,'queued'=>0,'state'=>'running'));
khushii_npp_import_batch(); khushii_npp_import_batch(); khushii_npp_import_batch();
$job=get_option('khushii_npp_import');
check($job['scanned']===123 && $job['queued']===123 && $job['state']==='scan complete','all 123 leads queued across multiple automatic batches');
if(function_exists('openssl_encrypt')) {
 $encrypted=khushii_npp_encrypt('a-private-integration-secret');
 check(is_string($encrypted) && strpos($encrypted,'a-private-integration-secret')===false,'secret encrypted');
 $raw=base64_decode($encrypted,true);
 check(openssl_decrypt(substr($raw,28),'aes-256-gcm',hash('sha256',wp_salt('auth'),true),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16))==='a-private-integration-secret','encrypted secret can be read with WordPress salt');
} else {check(false,'OpenSSL extension required for security tests');}
function current_user_can($cap){return true;}
function admin_url($path){return 'https://example.test/wp-admin/'.$path;}
function esc_url($v){return htmlspecialchars($v,ENT_QUOTES);}
function esc_attr($v){return htmlspecialchars($v,ENT_QUOTES);}
function esc_html($v){return htmlspecialchars($v,ENT_QUOTES);}
function wp_nonce_field($action){echo '<input name="_wpnonce" value="test-only">';}
function submit_button($label){echo '<button>'.htmlspecialchars($label,ENT_QUOTES).'</button>';}
ob_start(); khushii_npp_admin_page(); $screen=ob_get_clean();
check(strpos($screen,'name="api_url"')!==false && strpos($screen,'name="api_secret"')!==false,'connection input controls rendered');
check(strpos($screen,'Save connection')!==false && strpos($screen,'Test CRM connection')!==false && strpos($screen,'Import all saved enquiries')!==false,'connection and import actions present');
check(strpos($screen,KHUSHII_CRM_WEBHOOK_SECRET)===false,'saved secret never rendered');
class ExportRequest {
 public $headers; public $after;
 public function __construct($headers,$after){$this->headers=$headers;$this->after=$after;}
 public function get_header($name){return $this->headers[$name]??'';}
 public function get_param($name){return $name==='after'?$this->after:null;}
}
$stamp=(string)time();$canonical="GET\n/khushii-crm/v1/enquiries?after=0&limit=50";
$headers=array('x-crm-timestamp'=>$stamp,'x-crm-signature'=>'sha256='.hash_hmac('sha256',$stamp.'.'.$canonical,KHUSHII_CRM_WEBHOOK_SECRET));
$request=new ExportRequest($headers,0);
check(khushii_npp_export_permission($request)===true,'signed pull request authorized');
check(is_wp_error(khushii_npp_export_permission(new ExportRequest(array(),0))),'unsigned pull rejected');
$wrong=$headers;$wrong['x-crm-signature']='sha256='.str_repeat('0',64);
check(is_wp_error(khushii_npp_export_permission(new ExportRequest($wrong,0))),'wrong secret rejected');
foreach(range(1000,1122) as $id){$GLOBALS['meta'][$id]=$GLOBALS['meta'][42];}
$export=khushii_npp_export_enquiries($request);
check(count($export['items'])===50 && $export['hasMore'] && $export['nextAfter']===1049,'private lead export is bounded and advances cursor');
$again=khushii_npp_export_payload(42);
check($again['externalSubmissionId']===$payload['externalSubmissionId'],'push and pull share the same duplicate prevention key');
$GLOBALS['meta'][84]=array('_khep_name'=>'Example Contact','_khep_email'=>'contact@example.test','_khep_phone'=>'98765 43210','_khep_interest'=>'General Enquiry','_khep_message'=>str_repeat('A',3000),'_khep_consent'=>'Yes');
$contact=khushii_npp_export_payload(84);
check(!is_wp_error($contact)&&strpos($contact['externalSubmissionId'],'khep:')===0,'Enquiry Pro gets its own stable namespace');
check($contact['email']==='contact@example.test'&&strpos($contact['message'],'Interest: General Enquiry')===0,'Enquiry Pro fields mapped');
check(strpos($contact['message'],str_repeat('A',3000))!==false,'full 3000-character contact message retained');
check(strpos($contact['message'],'enquiry response only')!==false,'contact consent is not promoted to marketing consent');
$before=count($GLOBALS['hooks']['shutdown']);
khushii_npp_meta_saved(1,84,'_khep_crm_status','Not configured');
check(count($GLOBALS['hooks']['shutdown'])===$before+1,'Enquiry Pro final metadata queues immediate delivery');
$GLOBALS['response_status']=202;khushii_npp_deliver(84);
check(get_post_meta(84,'_khushii_crm_status',true)==='sent','Enquiry Pro push delivered');
$last=json_decode(end($GLOBALS['requests'])[1]['body'],true);
check($last['externalSubmissionId']===$contact['externalSubmissionId'],'Enquiry Pro push and pull have identical keys');
echo "Nestoria connector behavior tests passed (including import of 123 enquiries and secret encryption)\n";
