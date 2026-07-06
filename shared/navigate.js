import { push, launchApp } from '@zos/router'

/*
* will open the app
* @appid  if  defined will open the app with id
* @page defines the page. Can be used as page_name.subpage  , this will set url as page/page_name and add param "subpage"
* or it is also possible to use "subpage", in this case would be used default url 'page/index'
* @params additional params which would be added
 */

export function gotoSubpage(page, params, appid) {
    if (!params) params = {};

    let url = 'page/index'
    if (page.indexOf('.') !== -1) {
        let r = page.split('.')
        url = 'page/' + r[0]
        page = r[1]
    }

    const queryParams = {
        page, ...params
    }

    if (appid) {
        launchApp({
            appId: appid,
            url: url,
            params: queryParams
        })
    } else {
        push({
            url: url,
            params: JSON.stringify(queryParams)
        })
    }
}