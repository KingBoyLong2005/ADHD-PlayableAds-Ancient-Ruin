
export class super_html_playable {

    download() {

        //@ts-ignore
        window.super_html && super_html.download();
    }

    game_end() {

        //@ts-ignore
        window.super_html && super_html.game_end();
    }

    is_hide_download() {
        //@ts-ignore
        if (window.super_html && super_html.is_hide_download) {
            //@ts-ignore
            return super_html.is_hide_download();
        }
        return false
    }

    set_google_play_url(url: string) {
        //@ts-ignore
        window.super_html && (super_html.google_play_url = url);
    }

    set_app_store_url(url: string) {
        //@ts-ignore
        window.super_html && (super_html.appstore_url = url);
    }

}
export default new super_html_playable();
