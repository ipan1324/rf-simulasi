import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(os.path.dirname(__file__), 'img') + '/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'], executable_path='/usr/bin/google-chrome')
        pg = await b.new_page(viewport={'width': 1360, 'height': 900}, device_scale_factor=1.5)
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(700)
        box = await pg.locator('.main').bounding_box()
        await pg.screenshot(path=OUT + 'web1_input.png', clip={'x': box['x'], 'y': 0, 'width': box['width'], 'height': 1010}, full_page=True)
        await pg.locator('#s-boot').screenshot(path=OUT + 'web2_bootstrap.png')
        await pg.locator('.diagram').screenshot(path=OUT + 'web3_tree1.png')
        ib = await pg.locator('#insp').bounding_box()
        await pg.screenshot(path=OUT + 'web4_node1.png', clip={'x': ib['x'] - 12, 'y': ib['y'] - 8, 'width': ib['width'] + 24, 'height': min(ib['height'], 980)}, full_page=True)
        await pg.locator('#s-vote').screenshot(path=OUT + 'web5_vote.png')
        await b.close()
asyncio.run(main())
