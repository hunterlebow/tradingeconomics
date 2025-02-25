# Credit Ratings Explorer

A modern web application for comparing sovereign credit ratings across countries from major rating agencies.

## Overview

Credit Ratings Explorer allows users to compare credit ratings for different countries side by side. The application fetches data from the Trading Economics API and presents it in an intuitive, card-based interface.

## Features

- Compare credit ratings for two countries side by side
- View ratings from multiple agencies (S&P, Moody's, Fitch, DBRS, Trading Economics)
- See credit score summaries and analysis
- Modern, responsive UI built with Bootstrap and custom CSS
- Rate-limited API requests to avoid hitting API limits
- Caching to improve performance and reduce API calls

## Technical Details

### Backend

- **Flask**: Lightweight Python web framework
- **Trading Economics API**: Source of credit ratings data
- **Rate Limiting**: Implemented to avoid API rate limits
- **Caching**: Stores API responses to reduce redundant calls

### Frontend

- **Bootstrap**: For responsive layout and components
- **Custom CSS**: Modern, card-based UI inspired by financial platforms
- **Vanilla JavaScript**: No frameworks, just clean, modular JS

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Run the application:
   ```
   python app.py
   ```
4. Open your browser and navigate to `http://localhost:5001`

## Dependencies

- Flask 2.2.3
- Requests 2.28.2
- NumPy 1.23.5
- Pandas 1.5.3
- Trading Economics API client
- Werkzeug 2.2.3

## API Usage

The application uses the Trading Economics API to fetch credit ratings data. It attempts to use the Trading Economics SDK if available, and falls back to direct API calls if necessary.

## Rate Limiting

To avoid hitting API rate limits, the application implements a simple rate limiter that ensures requests are not made more frequently than once per second.

## Caching

Successful API responses are cached in memory to improve performance and reduce the number of API calls.

## Author

Hunter Lebow - [LinkedIn](https://www.linkedin.com/in/hunterlebow)

## License

This project is for educational purposes only. All data is provided by Trading Economics.
