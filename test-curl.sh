#!/bin/bash

# HttpOnly Cookies Test Script
# Make sure Strapi is running on http://localhost:1337

BASE_URL="http://localhost:1337"
COOKIE_FILE="cookies.txt"

echo "🍪 HttpOnly Cookies Authentication Test"
echo "========================================"

# Clean up any existing cookies
rm -f $COOKIE_FILE

echo ""
echo "1. Testing Login..."
echo "-------------------"

# Login request
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"password123"}' \
  -c $COOKIE_FILE \
  -w "\nHTTP_STATUS:%{http_code}")

# Extract HTTP status
HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Status: $HTTP_STATUS"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Login successful!"
    
    echo ""
    echo "2. Testing Authentication..."
    echo "----------------------------"
    
    # Test authentication with cookies
    AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/products/test-auth" \
      -b $COOKIE_FILE \
      -w "\nHTTP_STATUS:%{http_code}")
    
    AUTH_STATUS=$(echo "$AUTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    AUTH_BODY=$(echo "$AUTH_RESPONSE" | sed '/HTTP_STATUS:/d')
    
    echo "Status: $AUTH_STATUS"
    echo "Response: $AUTH_BODY"
    
    if [ "$AUTH_STATUS" = "200" ]; then
        echo "✅ Authentication successful!"
        
        echo ""
        echo "3. Testing Protected Data..."
        echo "-----------------------------"
        
        # Get protected data
        DATA_RESPONSE=$(curl -s -X GET "$BASE_URL/api/products/protected-data" \
          -b $COOKIE_FILE \
          -w "\nHTTP_STATUS:%{http_code}")
        
        DATA_STATUS=$(echo "$DATA_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
        DATA_BODY=$(echo "$DATA_RESPONSE" | sed '/HTTP_STATUS:/d')
        
        echo "Status: $DATA_STATUS"
        echo "Response: $DATA_BODY"
        
        if [ "$DATA_STATUS" = "200" ]; then
            echo "✅ Protected data retrieved successfully!"
        else
            echo "❌ Failed to get protected data"
        fi
        
        echo ""
        echo "4. Testing Logout..."
        echo "--------------------"
        
        # Logout
        LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
          -b $COOKIE_FILE \
          -w "\nHTTP_STATUS:%{http_code}")
        
        LOGOUT_STATUS=$(echo "$LOGOUT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
        LOGOUT_BODY=$(echo "$LOGOUT_RESPONSE" | sed '/HTTP_STATUS:/d')
        
        echo "Status: $LOGOUT_STATUS"
        echo "Response: $LOGOUT_BODY"
        
        if [ "$LOGOUT_STATUS" = "200" ]; then
            echo "✅ Logout successful!"
        else
            echo "❌ Logout failed"
        fi
        
    else
        echo "❌ Authentication failed"
    fi
    
else
    echo "❌ Login failed"
    echo "Note: You may need to create a user first or use correct credentials"
fi

echo ""
echo "5. Cookie Security Check..."
echo "---------------------------"

# Check if cookies are visible in the file
if [ -f "$COOKIE_FILE" ]; then
    echo "Cookies stored in file:"
    cat $COOKIE_FILE
    echo ""
    echo "Note: HttpOnly cookies should be present but not accessible via JavaScript"
else
    echo "No cookies file found"
fi

# Clean up
rm -f $COOKIE_FILE

echo ""
echo "�� Test completed!" 