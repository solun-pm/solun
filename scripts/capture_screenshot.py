"""
Screenshot capture script for visual SEO analysis
Uses Playwright to capture desktop and mobile screenshots
"""
from playwright.sync_api import sync_playwright
import sys
import json


def capture_screenshot(url, output_path, viewport_width=1920, viewport_height=1080, full_page=False):
    """Capture screenshot with specified viewport size"""
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': viewport_width, 'height': viewport_height})
            page.goto(url, wait_until='networkidle', timeout=30000)
            page.screenshot(path=output_path, full_page=full_page)
            browser.close()
            return True
    except Exception as e:
        print(f"Error capturing screenshot: {e}", file=sys.stderr)
        return False


def analyze_page_metrics(url, viewport_width=1920, viewport_height=1080):
    """Analyze page and collect metrics for SEO analysis"""
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': viewport_width, 'height': viewport_height})
            page.goto(url, wait_until='networkidle', timeout=30000)

            # Collect metrics
            metrics = {
                'url': url,
                'viewport': f"{viewport_width}x{viewport_height}",
                'title': page.title(),
            }

            # Check above-the-fold elements
            h1_visible = page.evaluate("""() => {
                const h1 = document.querySelector('h1');
                if (!h1) return false;
                const rect = h1.getBoundingClientRect();
                return rect.top >= 0 && rect.top < window.innerHeight;
            }""")

            cta_buttons = page.evaluate("""() => {
                const selectors = ['button', '[role="button"]', 'a[href*="signup"]', 'a[href*="start"]', 'a[href*="get-started"]', '.cta', '[class*="cta"]'];
                let ctasAboveFold = [];
                selectors.forEach(sel => {
                    const elements = document.querySelectorAll(sel);
                    elements.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.top >= 0 && rect.top < window.innerHeight) {
                            ctasAboveFold.push({
                                tag: el.tagName,
                                text: el.textContent.trim().substring(0, 50),
                                top: rect.top
                            });
                        }
                    });
                });
                return ctasAboveFold;
            }""")

            # Check for images above the fold
            images_above_fold = page.evaluate("""() => {
                const images = document.querySelectorAll('img');
                let count = 0;
                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.top >= 0 && rect.top < window.innerHeight) {
                        count++;
                    }
                });
                return count;
            }""")

            # Get page height and fold info
            page_info = page.evaluate("""() => {
                return {
                    scrollHeight: document.documentElement.scrollHeight,
                    viewportHeight: window.innerHeight,
                    hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
                };
            }""")

            metrics['h1_visible_above_fold'] = h1_visible
            metrics['cta_buttons_above_fold'] = cta_buttons
            metrics['images_above_fold'] = images_above_fold
            metrics['page_info'] = page_info

            browser.close()
            return metrics
    except Exception as e:
        print(f"Error analyzing page: {e}", file=sys.stderr)
        return None


if __name__ == "__main__":
    url = "https://solun.pm"

    # Capture desktop screenshot
    print("Capturing desktop screenshot (1920x1080)...")
    capture_screenshot(url, "C:/Users/jschroeder/projects/solun/screenshots/desktop_1920x1080.png", 1920, 1080, False)

    # Capture laptop screenshot
    print("Capturing laptop screenshot (1366x768)...")
    capture_screenshot(url, "C:/Users/jschroeder/projects/solun/screenshots/laptop_1366x768.png", 1366, 768, False)

    # Capture tablet screenshot
    print("Capturing tablet screenshot (768x1024)...")
    capture_screenshot(url, "C:/Users/jschroeder/projects/solun/screenshots/tablet_768x1024.png", 768, 1024, False)

    # Capture mobile screenshot
    print("Capturing mobile screenshot (375x812)...")
    capture_screenshot(url, "C:/Users/jschroeder/projects/solun/screenshots/mobile_375x812.png", 375, 812, False)

    # Analyze desktop metrics
    print("\nAnalyzing desktop metrics...")
    desktop_metrics = analyze_page_metrics(url, 1920, 1080)
    with open("C:/Users/jschroeder/projects/solun/screenshots/desktop_metrics.json", "w") as f:
        json.dump(desktop_metrics, f, indent=2)

    # Analyze mobile metrics
    print("Analyzing mobile metrics...")
    mobile_metrics = analyze_page_metrics(url, 375, 812)
    with open("C:/Users/jschroeder/projects/solun/screenshots/mobile_metrics.json", "w") as f:
        json.dump(mobile_metrics, f, indent=2)

    print("\nScreenshot capture and analysis complete!")
