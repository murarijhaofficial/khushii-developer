<?php
/**
 * Server-side helper for a custom WordPress plugin. Include from PHP only.
 * Configure KHUSHII_CRM_API_URL and KHUSHII_CRM_WEBHOOK_SECRET in wp-config.php
 * or the server environment, never in frontend JavaScript.
 */
function khushii_crm_send_website_lead( $submission_id, $name, $phone, $email = '', $message = '', $project_slug = '' ) {
    $base = defined( 'KHUSHII_CRM_API_URL' ) ? KHUSHII_CRM_API_URL : getenv( 'KHUSHII_CRM_API_URL' );
    $secret = defined( 'KHUSHII_CRM_WEBHOOK_SECRET' ) ? KHUSHII_CRM_WEBHOOK_SECRET : getenv( 'KHUSHII_CRM_WEBHOOK_SECRET' );
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
    $response = wp_remote_post( untrailingslashit( $base ) . '/integrations/signed-website-leads', array(
        'timeout' => 10, 'redirection' => 0, 'sslverify' => true,
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
