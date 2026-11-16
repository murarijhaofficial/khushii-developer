<?php
/**
 * Plugin Name: Khushii CRM Connector for Nestoria
 * Description: Queues Nestoria Property Projects enquiries for signed delivery to Khushii CRM.
 * Version: 0.4.0
 * Requires PHP: 7.4
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
function khushii_crm_send_website_lead( $submission_id, $name, $phone, $email = '', $message = '', $project_slug = '' ) {
    $base = khushii_npp_setting('url');
    $secret = khushii_npp_setting('secret');
    if ( ! is_string( $base ) || ! is_string( $secret ) || strlen( $secret ) < 24 || ! wp_http_validate_url( $base ) || 'https' !== wp_parse_url( $base, PHP_URL_SCHEME ) ) {
        return new WP_Error( 'crm_config', 'Configure an HTTPS CRM API URL and integration secret on the server.' );
    }
    if ( ! is_string( $submission_id ) || '' === $submission_id ) {
        return new WP_Error( 'crm_submission_id', 'Provide a stable submission ID for retries.' );
    }
    $payload = array( 'externalSubmissionId' => $submission_id, 'name' => $name, 'phone' => $phone, 'source' => 'website' );
    if ( '' !== $email ) { $payload['email'] = $email; }
    if ( '' !== $message ) { $payload['message'] = $message; }
    if ( '' !== $project_slug ) { $payload['projectSlug'] = $project_slug; }
    $body = wp_json_encode( $payload );
    if ( false === $body ) { return new WP_Error( 'crm_encode', 'Could not encode the submission.' ); }
    $timestamp = (string) time();
    $signature = 'sha256=' . hash_hmac( 'sha256', $timestamp . '.' . $body, $secret );
    $response = wp_safe_remote_post( untrailingslashit( $base ) . '/integrations/signed-website-leads', array(
        'timeout' => 20, 'redirection' => 0, 'sslverify' => true,
        'headers' => array( 'Content-Type' => 'application/json', 'X-CRM-Timestamp' => $timestamp, 'X-CRM-Signature' => $signature ),
        'body' => $body,
    ) );
    if ( is_wp_error( $response ) ) { return $response; }
    $status = wp_remote_retrieve_response_code( $response );
    if ( 202 !== $status ) { return new WP_Error( 'crm_delivery', 'CRM rejected the submission.', array( 'status' => $status ) ); }
    $result = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( ! is_array( $result ) || empty( $result['accepted'] ) || empty( $result['id'] ) ) { return new WP_Error( 'crm_response', 'CRM returned an invalid response.' ); }
    return $result;
}


function khushii_npp_encrypt($secret) {
    if(!function_exists('openssl_encrypt')) return false;
    $iv=random_bytes(12); $tag='';
    $cipher=openssl_encrypt($secret,'aes-256-gcm',hash('sha256',wp_salt('auth'),true),OPENSSL_RAW_DATA,$iv,$tag);
    return false===$cipher?false:base64_encode($iv.$tag.$cipher);
}
function khushii_npp_setting($key) {
    $constant='url'===$key?'KHUSHII_CRM_API_URL':'KHUSHII_CRM_WEBHOOK_SECRET';
    if(defined($constant)) return (string)constant($constant);
    $env=getenv($constant); if(is_string($env)&&''!==$env) return $env;
    if('url'===$key) return (string)get_option('khushii_npp_api_url','');
    $stored=base64_decode((string)get_option('khushii_npp_secret',''),true);
    if(!$stored||strlen($stored)<29||!function_exists('openssl_decrypt')) return '';
    $plain=openssl_decrypt(substr($stored,28),'aes-256-gcm',hash('sha256',wp_salt('auth'),true),OPENSSL_RAW_DATA,substr($stored,0,12),substr($stored,12,16));
    return false===$plain?'':$plain;
}
function khushii_npp_save_connection() {
    if(!current_user_can('manage_options')) wp_die('Forbidden','',array('response'=>403));
    check_admin_referer('khushii_npp_save');
    $url=isset($_POST['api_url'])&&is_string($_POST['api_url'])?untrailingslashit(trim(wp_unslash($_POST['api_url']))):'';
    $secret=isset($_POST['api_secret'])&&is_string($_POST['api_secret'])?trim(wp_unslash($_POST['api_secret'])):'';
    if(preg_match('~^https://[^/]+$~',$url)) $url.='/api/v1';
    if(!wp_http_validate_url($url)||'https'!==wp_parse_url($url,PHP_URL_SCHEME)||wp_parse_url($url,PHP_URL_QUERY)||wp_parse_url($url,PHP_URL_USER)||wp_parse_url($url,PHP_URL_FRAGMENT)||!preg_match('~/api/v1$~',$url)) wp_die('Enter the public HTTPS API address ending in /api/v1, without credentials or query parameters.');
    if(''!==$secret) {
        if(strlen($secret)<24||strlen($secret)>512||preg_match('/[\r\n]/',$secret)) wp_die('The integration secret must have 24 to 512 characters.');
        $encrypted=khushii_npp_encrypt($secret);
        if(false===$encrypted) wp_die('PHP OpenSSL is required to save the secret securely.');
        update_option('khushii_npp_secret',$encrypted,false);
    }
    update_option('khushii_npp_api_url',$url,false);
    update_option('khushii_npp_connection_test','Settings saved. Run Test CRM connection to verify delivery access.',false);
    wp_safe_redirect(add_query_arg(array('post_type'=>'npp_project','page'=>'khushii-npp-connector'),admin_url('edit.php'))); exit;
}
add_action('admin_post_khushii_npp_save','khushii_npp_save_connection');

const KHUSHII_NPP_CRON = 'khushii_npp_deliver_enquiry';

function khushii_npp_configured() {
    $url = khushii_npp_setting('url');
    $secret = khushii_npp_setting('secret');
    return is_string( $url ) && wp_http_validate_url( $url ) && 'https' === wp_parse_url( $url, PHP_URL_SCHEME ) && is_string( $secret ) && strlen( $secret ) >= 24;
}

/** Convert explicit international numbers, or Indian 10-digit mobiles, to E.164. */
function khushii_npp_phone( $raw ) {
    $raw = trim( (string) $raw );
    if ( ! preg_match( '/^[0-9+\s().-]{7,20}$/', $raw ) || substr_count( $raw, '+' ) > 1 || ( strpos( $raw, '+' ) !== false && strpos( $raw, '+' ) !== 0 ) ) { return ''; }
    $digits = preg_replace( '/\D/', '', $raw );
    if ( isset( $raw[0] ) && '+' === $raw[0] ) { $phone = '+' . $digits; }
    elseif ( preg_match( '/^0[6-9][0-9]{9}$/', $digits ) ) { $phone = '+91' . substr( $digits, 1 ); }
    elseif ( preg_match( '/^[6-9][0-9]{9}$/', $digits ) ) { $phone = '+91' . $digits; }
    elseif ( preg_match( '/^91[6-9][0-9]{9}$/', $digits ) ) { $phone = '+' . $digits; }
    else { return ''; }
    return preg_match( '/^\+[1-9][0-9]{7,14}$/', $phone ) ? $phone : '';
}

function khushii_npp_queue( $lead_id, $delay = 10 ) {
    $lead_id = absint( $lead_id );
    if ( 'npp_lead' !== get_post_type( $lead_id ) || 'private' !== get_post_status( $lead_id ) || 'sent' === get_post_meta( $lead_id, '_khushii_crm_status', true ) ) { return false; }
    if ( ! khushii_npp_configured() ) { update_post_meta( $lead_id, '_khushii_crm_status', 'waiting' ); return false; }
    $args = array( $lead_id );
    if ( ! wp_next_scheduled( KHUSHII_NPP_CRON, $args ) ) {
        $scheduled = wp_schedule_single_event( time() + max(10, (int) $delay), KHUSHII_NPP_CRON, $args, true );
        if ( is_wp_error( $scheduled ) || ! $scheduled ) { update_post_meta( $lead_id, '_khushii_crm_status', 'failed' ); return false; }
    }
    update_post_meta( $lead_id, '_khushii_crm_status', 'queued' );
    return true;
}

/** Nestoria writes this key after all other enquiry metadata. */
function khushii_npp_meta_saved( $meta_id, $post_id, $meta_key, $meta_value ) {
    if ( '_npp_lead_source_url' === $meta_key && 'npp_lead' === get_post_type( $post_id ) ) {
        if(khushii_npp_queue($post_id)) add_action('shutdown',function()use($post_id){khushii_npp_deliver($post_id);},20);
    }
}
add_action( 'added_post_meta', 'khushii_npp_meta_saved', 10, 4 );

function khushii_npp_deliver( $lead_id ) {
    $lead_id = absint( $lead_id );
    if ( 'npp_lead' !== get_post_type( $lead_id ) || 'private' !== get_post_status( $lead_id ) || 'sent' === get_post_meta( $lead_id, '_khushii_crm_status', true ) ) { return; }
    $lock = (int) get_post_meta( $lead_id, '_khushii_crm_lock', true );
    if ( $lock && $lock < time() - 900 ) { delete_post_meta( $lead_id, '_khushii_crm_lock', (string) $lock ); }
    if ( ! add_post_meta( $lead_id, '_khushii_crm_lock', (string) time(), true ) ) { return; }
    try {
        $payload=khushii_npp_export_payload($lead_id);
        if(is_wp_error($payload)){update_post_meta($lead_id,'_khushii_crm_status','needs_review');update_post_meta($lead_id,'_khushii_crm_error','Check name, phone and email.');return;}
        update_post_meta($lead_id,'_khushii_crm_last_attempt',gmdate('c'));
        $result = khushii_crm_send_website_lead( $payload['externalSubmissionId'], $payload['name'], $payload['phone'], $payload['email']??'', $payload['message'], $payload['projectSlug']??'' );
        if ( ! is_wp_error( $result ) ) {
            update_post_meta( $lead_id, '_khushii_crm_status', 'sent' );
            update_post_meta( $lead_id, '_khushii_crm_lead_id', sanitize_text_field( $result['id'] ) );
            delete_post_meta( $lead_id, '_khushii_crm_attempts' );
            delete_post_meta($lead_id,'_khushii_crm_error');
            wp_clear_scheduled_hook(KHUSHII_NPP_CRON,array($lead_id));
            return;
        }
        $error_data=$result->get_error_data();
        $http=is_array($error_data)&&isset($error_data['status'])?(int)$error_data['status']:0;
        $errors=array(400=>'Check name, phone, email and project fields',401=>'Secret mismatch or server clock differs',404=>'Wrong API address or outdated Render deployment',429=>'API rate limit reached');
        $reason=$http?'HTTP '.$http.': '.($errors[$http]??'API unavailable'):'Network or HTTPS error; check Render and the hosting firewall';
        update_post_meta($lead_id,'_khushii_crm_error',$reason);
        $attempt = (int) get_post_meta( $lead_id, '_khushii_crm_attempts', true ) + 1;
        update_post_meta( $lead_id, '_khushii_crm_attempts', $attempt );
        update_post_meta( $lead_id, '_khushii_crm_status', 'failed' );
        $delays = array( 60, 300, 900, 3600, 21600 );
        if ( $attempt <= count( $delays ) && khushii_npp_configured() ) {
            $scheduled = wp_schedule_single_event( time() + $delays[ $attempt - 1 ], KHUSHII_NPP_CRON, array( $lead_id ), true );
            if ( ! is_wp_error( $scheduled ) && $scheduled ) { update_post_meta( $lead_id, '_khushii_crm_status', 'queued' ); }
        }
    } finally {
        delete_post_meta( $lead_id, '_khushii_crm_lock' );
    }
}
add_action( KHUSHII_NPP_CRON, 'khushii_npp_deliver' );

function khushii_npp_menu() { add_submenu_page( 'edit.php?post_type=npp_project', 'CRM Connector', 'CRM Connector', 'manage_options', 'khushii-npp-connector', 'khushii_npp_admin_page' ); add_options_page('CRM Connector','Nestoria CRM Connector','manage_options','khushii-npp-connector','khushii_npp_admin_page'); }
add_action( 'admin_menu', 'khushii_npp_menu' );
function khushii_npp_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) { return; }
    echo '<div class="wrap"><h1>Khushii CRM Connector</h1><p>Connection configuration: <strong>' . ( khushii_npp_configured() ? 'Configured (delivery not verified)' : 'Not configured' ) . '</strong></p>';
    echo '<form method="post" action="'.esc_url(admin_url('admin-post.php')).'">';
    wp_nonce_field('khushii_npp_save'); echo '<input type="hidden" name="action" value="khushii_npp_save">';
    echo '<p><label>CRM API URL<br><input type="url" name="api_url" class="regular-text" required placeholder="https://YOUR-API.example/api/v1" value="'.esc_attr(khushii_npp_setting('url')?:'https://khushii-developer.onrender.com/api/v1').'"></label></p>';
    echo '<p><label>Integration secret<br><input type="password" name="api_secret" class="regular-text" autocomplete="new-password" placeholder="Leave blank to keep the saved secret"></label></p>';
    echo '<p>Use the CRM API server WEBHOOK_SHARED_SECRET, not your CRM login password. The saved secret is encrypted and never displayed. A public HTTPS API is required; localhost cannot be reached from this website. Server constants or environment variables override saved settings.</p>';
    submit_button('Save connection'); echo '</form>';
    echo '<p>New Nestoria enquiries are queued automatically. Import all scans saved enquiries automatically in background batches. Sent records are skipped and retries reuse the same ID. Invalid names, phone numbers or emails are marked for review in Property Enquiries and are excluded from bulk retry. Local 10-digit Indian mobile numbers are normalized to +91.</p>';
    echo '<p>WordPress Cron requires site traffic or a real server cron job. Successful configuration alone does not confirm delivery.</p>';
    echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
    wp_nonce_field( 'khushii_npp_queue_existing' );
    echo '<input type="hidden" name="action" value="khushii_npp_queue_existing">';
    submit_button( 'Import all saved enquiries' );
    echo '</form>';
    if ( isset( $_GET['queued'] ) ) { echo '<p>Queued: ' . esc_html( (string) absint( $_GET['queued'] ) ) . '</p>'; }
    $progress = get_option('khushii_npp_import', array());
    if ( $progress ) { echo '<p>Import scan: '.esc_html($progress['state']).' ? examined '.esc_html((string)$progress['scanned']).', queued '.esc_html((string)$progress['queued']).'. Queued does not mean delivered; check the CRM sync column.</p>'; }
    echo '<form method="post" action="'.esc_url(admin_url('admin-post.php')).'">';
    wp_nonce_field('khushii_npp_test');
    echo '<input type="hidden" name="action" value="khushii_npp_test">'; submit_button('Test CRM connection'); echo '</form>';
    $test=get_option('khushii_npp_connection_test',''); if($test) echo '<p>'.esc_html($test).'</p>';
    echo '<form method="post" action="'.esc_url(admin_url('admin-post.php')).'">';wp_nonce_field('khushii_npp_send_next');echo '<input type="hidden" name="action" value="khushii_npp_send_next">';submit_button('Send next queued enquiry now');echo '</form><p>This sends one pending enquiry immediately, even if WordPress Cron is delayed.</p>';
    $manual=get_option('khushii_npp_manual_result','');if($manual)echo '<p>'.esc_html($manual).'</p>';
    echo '</div>';
}
function khushii_npp_queue_existing() {
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); }
    check_admin_referer( 'khushii_npp_queue_existing' );
    if ( ! khushii_npp_configured() ) { wp_die( 'Configure the CRM connection before queueing enquiries.' ); }
    wp_clear_scheduled_hook( 'khushii_npp_import_batch' );
    update_option( 'khushii_npp_import', array( 'cursor'=>0, 'scanned'=>0, 'queued'=>0, 'state'=>'running' ), false );
    khushii_npp_import_batch();
    wp_safe_redirect( add_query_arg( array( 'post_type'=>'npp_project', 'page'=>'khushii-npp-connector' ), admin_url('edit.php') ) );
    exit;
}
add_action( 'admin_post_khushii_npp_queue_existing', 'khushii_npp_queue_existing' );

function khushii_npp_lead_columns( $columns ) { $columns['khushii_crm'] = 'CRM sync'; return $columns; }
add_filter( 'manage_npp_lead_posts_columns', 'khushii_npp_lead_columns', 20 );
function khushii_npp_lead_column( $column, $post_id ) {
    if ( 'khushii_crm' !== $column ) { return; }
    $labels = array( 'sent' => 'Sent', 'queued' => 'Queued', 'waiting' => 'Needs configuration', 'failed' => 'Delivery failed', 'needs_review' => 'Check name, phone or email' );
    $status = (string) get_post_meta( $post_id, '_khushii_crm_status', true );
    echo esc_html( isset( $labels[ $status ] ) ? $labels[ $status ] : 'Not queued' );
    $reason=get_post_meta($post_id,'_khushii_crm_error',true);if($reason) echo '<br><small>'.esc_html($reason).'</small>';
}
add_action( 'manage_npp_lead_posts_custom_column', 'khushii_npp_lead_column', 20, 2 );

/** Seek by immutable post ID so deleted or newly inserted records cannot shift the scan. */
function khushii_npp_import_batch() {
    global $wpdb;
    $job = get_option('khushii_npp_import', array());
    if ( empty($job) || 'running' !== $job['state'] ) return;
    $ids = $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_status = %s AND ID > %d ORDER BY ID ASC LIMIT 50", 'npp_lead', 'private', (int)$job['cursor']));
    if ( !is_array($ids) ) { $job['state']='database error'; update_option('khushii_npp_import',$job,false); return; }
    foreach($ids as $index=>$id) {
        $status=get_post_meta($id,'_khushii_crm_status',true);
        if ('sent' !== $status && 'needs_review' !== $status) {
            delete_post_meta($id,'_khushii_crm_attempts');
            if(khushii_npp_queue($id, 10 + $index*5)) $job['queued']++;
        }
        $job['cursor']=(int)$id; $job['scanned']++;
    }
    if(count($ids)<50) $job['state']='scan complete';
    else {
        $scheduled=wp_schedule_single_event(time()+260,'khushii_npp_import_batch',array(),true);
        if(is_wp_error($scheduled)||!$scheduled) $job['state']='schedule failed; restart import';
    }
    update_option('khushii_npp_import',$job,false);
}
add_action('khushii_npp_import_batch','khushii_npp_import_batch');

function khushii_npp_test_connection() {
    if(!current_user_can('manage_options')) wp_die('Forbidden','',array('response'=>403));
    check_admin_referer('khushii_npp_test');
    $message='Configure the public HTTPS API URL and matching secret first.';
    if(khushii_npp_configured()) {
        $url=khushii_npp_setting('url');
        $secret=khushii_npp_setting('secret');
        $body='{}'; $timestamp=(string)time();
        $response=wp_safe_remote_post(untrailingslashit($url).'/integrations/website-connection',array('timeout'=>45,'redirection'=>0,'sslverify'=>true,'headers'=>array('Content-Type'=>'application/json','X-CRM-Timestamp'=>$timestamp,'X-CRM-Signature'=>'sha256='.hash_hmac('sha256',$timestamp.'.'.$body,$secret)),'body'=>$body));
        if(is_wp_error($response)) $message='Cannot reach CRM. Check the API address, DNS, TLS and hosting firewall.';
        else {
            $status=wp_remote_retrieve_response_code($response); $data=json_decode(wp_remote_retrieve_body($response),true);
            $message=200===$status && !empty($data['ready'])?'CRM connection verified. Ready to import.':'Connection failed (HTTP '.(int)$status.'). 401: secret or server clock; 404: API URL or outdated API; 500: CRM database.';
        }
    }
    update_option('khushii_npp_connection_test',$message,false);
    wp_safe_redirect(add_query_arg(array('post_type'=>'npp_project','page'=>'khushii-npp-connector'),admin_url('edit.php'))); exit;
}
add_action('admin_post_khushii_npp_test','khushii_npp_test_connection');

function khushii_npp_send_next() {
    if(!current_user_can('manage_options')) wp_die('Forbidden','',array('response'=>403));
    check_admin_referer('khushii_npp_send_next');
    if(!khushii_npp_configured()) wp_die('Save the API URL and integration secret first.');
    $ids=get_posts(array('post_type'=>'npp_lead','post_status'=>'private','posts_per_page'=>1,'fields'=>'ids','orderby'=>'ID','order'=>'ASC','meta_key'=>'_khushii_crm_status','meta_value'=>array('queued','failed','waiting'),'meta_compare'=>'IN'));
    $message='No pending enquiries. Run Import all saved enquiries first.';
    if($ids){$id=(int)$ids[0];khushii_npp_deliver($id);$status=get_post_meta($id,'_khushii_crm_status',true);$message='Enquiry #'.$id.': '.$status.'. '.get_post_meta($id,'_khushii_crm_error',true);}
    update_option('khushii_npp_manual_result',$message,false);
    wp_safe_redirect(add_query_arg(array('post_type'=>'npp_project','page'=>'khushii-npp-connector'),admin_url('edit.php')));exit;
}
add_action('admin_post_khushii_npp_send_next','khushii_npp_send_next');


function khushii_npp_export_payload($lead_id) {
    $name=(string)get_post_meta($lead_id,'_npp_lead_name',true);
    $phone=khushii_npp_phone(get_post_meta($lead_id,'_npp_lead_phone',true));
    $email=(string)get_post_meta($lead_id,'_npp_lead_email',true);if('Not provided'===$email)$email='';
    if(strlen($name)<2||!$phone||($email&&!is_email($email)))return new WP_Error('invalid_contact','Check name, phone and email.');
        $fields = array( 'Project' => 'project', 'Plot size' => 'plotsize', 'Budget' => 'budget', 'Preferred visit' => 'preferredsitevisit', 'Message' => 'message' );
        $parts = array();
        foreach ( $fields as $label => $key ) {
            $value = trim( (string) get_post_meta( $lead_id, '_npp_lead_' . $key, true ) );
            if ( '' !== $value ) { $parts[] = $label . ': ' . $value; }
        }
        $source_url = (string) get_post_meta( $lead_id, '_npp_lead_source_url', true );
        if ( $source_url ) { $parts[] = 'Source page: ' . esc_url_raw( $source_url ); }
        $message = wp_html_excerpt( implode( "\n", $parts ), 3000, '' );
        $project_id = absint( get_post_meta( $lead_id, '_npp_lead_project_id', true ) );
        $slug = $project_id && 'npp_project' === get_post_type( $project_id ) ? (string) get_post_field( 'post_name', $project_id ) : '';
        $submission_id = 'nestoria:' . substr( hash( 'sha256', home_url( '/' ) ), 0, 24 ) . ':' . $lead_id;

    $payload=array('externalSubmissionId'=>$submission_id,'name'=>$name,'phone'=>$phone,'source'=>'website','message'=>$message);
    if($email)$payload['email']=$email;if($slug)$payload['projectSlug']=$slug;
    return $payload;
}

/** Authenticated read-only export; private enquiries never become a public REST resource. */
function khushii_npp_export_permission($request) {
    $secret=khushii_npp_setting('secret');
    if(strlen($secret)<24)return new WP_Error('crm_configuration','Configure the matching integration secret in WordPress.',array('status'=>503));
    $stamp=(string)$request->get_header('x-crm-timestamp');$signature=(string)$request->get_header('x-crm-signature');
    if(!preg_match('/^[0-9]{10}$/',$stamp)||abs(time()-(int)$stamp)>300||!preg_match('/^sha256=[a-f0-9]{64}$/',$signature))return new WP_Error('crm_auth','Invalid signature or expired timestamp.',array('status'=>401));
    $after=(int)$request->get_param('after');
    $canonical="GET\n/khushii-crm/v1/enquiries?after=".$after.'&limit=50';
    $expected='sha256='.hash_hmac('sha256',$stamp.'.'.$canonical,$secret);
    return hash_equals($expected,$signature)?true:new WP_Error('crm_auth','Invalid signature.',array('status'=>401));
}
function khushii_npp_export_enquiries($request) {
    global $wpdb;
    $after=(int)$request->get_param('after');
    $ids=$wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_status = %s AND ID > %d ORDER BY ID ASC LIMIT 50",'npp_lead','private',$after));
    if(!is_array($ids))return new WP_Error('crm_database','Cannot read enquiries.',array('status'=>500));
    $items=array();$rejected=array();$next=$after;
    foreach($ids as $id){$next=(int)$id;$payload=khushii_npp_export_payload($id);if(is_wp_error($payload))$rejected[]=array('wordpressId'=>(int)$id,'reason'=>'Invalid name, phone or email');else $items[]=$payload;}
    return array('items'=>$items,'rejected'=>$rejected,'nextAfter'=>$next,'hasMore'=>count($ids)===50);
}
add_action('rest_api_init',function(){register_rest_route('khushii-crm/v1','/enquiries',array('methods'=>'GET','permission_callback'=>'khushii_npp_export_permission','callback'=>'khushii_npp_export_enquiries','args'=>array('after'=>array('default'=>0,'validate_callback'=>function($v){return is_scalar($v)&&preg_match('/^[0-9]{1,12}$/',(string)$v);}))));});
