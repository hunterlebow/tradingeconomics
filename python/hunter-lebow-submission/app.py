"""
Credit Ratings Explorer

A Flask application that provides an interface to compare sovereign credit ratings
across countries using the Trading Economics API.

Author: Hunter Lebow
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
import requests
import os
import json
import time
from datetime import datetime
from threading import Lock

# Try to import tradingeconomics, but don't fail if it's not available
try:
    import tradingeconomics as te
    te_available = True
except ImportError:
    te_available = False
    print("Warning: Trading Economics SDK not available. Using direct API calls instead.")

app = Flask(__name__, static_folder='static')

# Set the API key directly
API_KEY = "c18b5e77383b4e8:5r8ewn2uio5e5z2"

# Create a simple rate limiter to avoid API rate limiting issues
class RateLimiter:
    """Simple rate limiter to prevent API rate limiting issues"""
    
    def __init__(self, rate=1):  # 1 request per second
        self.rate = rate
        self.last_request_time = 0
        self.lock = Lock()
    
    def wait(self):
        """Wait if necessary to maintain the rate limit"""
        with self.lock:
            current_time = time.time()
            time_since_last_request = current_time - self.last_request_time
            
            if time_since_last_request < (1.0 / self.rate):
                sleep_time = (1.0 / self.rate) - time_since_last_request
                time.sleep(sleep_time)
            
            self.last_request_time = time.time()

# Create a rate limiter instance
rate_limiter = RateLimiter(rate=1)  # 1 request per second

# Create a simple cache to store API responses
ratings_cache = {}

# Login to Trading Economics API if available
if te_available:
    try:
        te.login(API_KEY)
        print("Successfully logged in to Trading Economics API")
    except Exception as e:
        print(f"Warning: Could not login to Trading Economics API: {e}")

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('static', path)

@app.route('/api/countries', methods=['GET'])
def get_countries():
    """Get available countries"""
    # For free accounts, we only have access to these countries
    free_countries = [
        {"Country": "Mexico", "CountryCode": "MX"},
        {"Country": "New Zealand", "CountryCode": "NZ"},
        {"Country": "Sweden", "CountryCode": "SE"},
        {"Country": "Thailand", "CountryCode": "TH"}
    ]
    
    print("Returning countries:", free_countries)
    # Always return the free countries for consistency
    return jsonify(free_countries)

@app.route('/api/credit-ratings', methods=['GET'])
def get_credit_ratings():
    """Get credit ratings for a country"""
    country = request.args.get('country', '')
    
    if not country:
        return jsonify({"error": "Country parameter is required"}), 400
    
    # Check if we have cached data for this country
    if country in ratings_cache:
        print(f"Returning cached data for {country}")
        return jsonify(ratings_cache[country])
    
    print(f"Fetching credit ratings for {country}")
    
    # Apply rate limiting
    rate_limiter.wait()
    
    # Try using the Trading Economics SDK if available
    if te_available:
        try:
            ratings_data = te.getRatings(country=country)
            
            # Check if we got a DataFrame (which is what the SDK returns)
            if hasattr(ratings_data, 'to_dict') and not ratings_data.empty:
                # Convert DataFrame to dict
                ratings_dict = ratings_data.to_dict('records')
                if ratings_dict:
                    # Process the ratings data from the SDK
                    processed_ratings = process_ratings_data(ratings_dict, country)
                    if processed_ratings:
                        # Cache the results
                        ratings_cache[country] = processed_ratings
                        return jsonify(processed_ratings)
        except Exception as e:
            print(f"Warning: Error using Trading Economics SDK: {e}")
            # If we get a 409 error, wait a bit longer before trying the direct API
            if "409" in str(e):
                time.sleep(1)
    
    # Apply rate limiting again before trying direct API
    rate_limiter.wait()
    
    # If SDK approach failed or not available, try direct API
    try:
        url = f'https://api.tradingeconomics.com/ratings/{country}?c={API_KEY}'
        response = requests.get(url)
        
        if response.status_code == 200:
            ratings = response.json()
            
            if ratings and len(ratings) > 0:
                # Process the ratings based on the actual response format
                processed_ratings = process_ratings_data(ratings, country)
                if processed_ratings:
                    # Cache the results
                    ratings_cache[country] = processed_ratings
                    return jsonify(processed_ratings)
        elif response.status_code == 409:
            # If we get a 409 error, wait a bit longer before returning
            time.sleep(1)
    except Exception as e:
        print(f"Warning: Error using direct API: {e}")
    
    # If all else fails, return empty object
    return jsonify({}), 200

def process_ratings_data(ratings_data, country):
    """Process ratings data from either SDK or API"""
    processed_ratings = {}
    
    # Check if the data is a list of dictionaries
    if isinstance(ratings_data, list):
        for rating in ratings_data:
            # Verify that the rating is for the requested country
            rating_country = rating.get('Country', '')
            if rating_country and rating_country != country:
                print(f"Warning: Rating is for {rating_country}, not {country}")
                continue
            
            # Extract ratings for each agency
            try:
                # Handle potential type conversion issues
                te_rating = 0
                if "TE" in rating and rating["TE"]:
                    try:
                        te_rating = int(float(str(rating["TE"]).replace(',', '').strip()))
                    except (ValueError, TypeError):
                        print(f"Warning: Could not convert TE rating to int: {rating['TE']}")
                        te_rating = 0
                
                # Process S&P rating
                if "SP" in rating and rating["SP"]:
                    processed_ratings["S&P"] = [{
                        "Agency": "S&P",
                        "Country": country,
                        "Rating": rating.get("SP", "N/A"),
                        "Outlook": rating.get("SP_Outlook", "N/A"),
                        "Date": datetime.now().strftime("%Y-%m-%d"),
                        "TE-Rating": te_rating
                    }]
                
                # Process Moody's rating
                if "Moodys" in rating and rating["Moodys"]:
                    processed_ratings["Moody's"] = [{
                        "Agency": "Moody's",
                        "Country": country,
                        "Rating": rating.get("Moodys", "N/A"),
                        "Outlook": rating.get("Moodys_Outlook", "N/A"),
                        "Date": datetime.now().strftime("%Y-%m-%d"),
                        "TE-Rating": te_rating
                    }]
                
                # Process Fitch rating
                if "Fitch" in rating and rating["Fitch"]:
                    processed_ratings["Fitch"] = [{
                        "Agency": "Fitch",
                        "Country": country,
                        "Rating": rating.get("Fitch", "N/A"),
                        "Outlook": rating.get("Fitch_Outlook", "N/A"),
                        "Date": datetime.now().strftime("%Y-%m-%d"),
                        "TE-Rating": te_rating
                    }]
                
                # Process DBRS rating
                if "DBRS" in rating and rating["DBRS"]:
                    processed_ratings["DBRS"] = [{
                        "Agency": "DBRS",
                        "Country": country,
                        "Rating": rating.get("DBRS", "N/A"),
                        "Outlook": rating.get("DBRS_Outlook", "N/A"),
                        "Date": datetime.now().strftime("%Y-%m-%d"),
                        "TE-Rating": te_rating
                    }]
                
                # Add Trading Economics rating
                if "TE" in rating and rating["TE"]:
                    processed_ratings["Trading Economics"] = [{
                        "Agency": "Trading Economics",
                        "Country": country,
                        "Rating": rating.get("TE", "N/A"),
                        "Outlook": rating.get("TE_Outlook", "N/A"),
                        "Date": datetime.now().strftime("%Y-%m-%d"),
                        "TE-Rating": te_rating
                    }]
            except Exception as e:
                print(f"Error processing rating: {e}")
    
    return processed_ratings

if __name__ == '__main__':
    # Create directories if they don't exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    
    # Changed port from default 5000 to 5001 to avoid conflicts with macOS AirPlay
    app.run(debug=True, port=5001) 