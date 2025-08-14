#!/bin/bash

# macOS App Icon Generator
# This script generates all required icon sizes for a Tauri macOS app
# with proper rounded corners following Apple's design guidelines

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SOURCE_DIR="localResources/iconPng"
OUTPUT_DIR="src-tauri/icons"

echo -e "${BLUE}🎨 macOS Icon Generator for DSA Learning App${NC}"
echo "=================================="

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo -e "${RED}❌ ImageMagick not found. Installing via Homebrew...${NC}"
    if command -v brew &> /dev/null; then
        brew install imagemagick
    else
        echo -e "${RED}❌ Homebrew not found. Please install ImageMagick manually:${NC}"
        echo "brew install imagemagick"
        exit 1
    fi
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Find the source PNG file
SOURCE_PNG=""
if [ -f "$SOURCE_DIR/app-icon.png" ]; then
    SOURCE_PNG="$SOURCE_DIR/app-icon.png"
elif [ -f "$SOURCE_DIR/icon.png" ]; then
    SOURCE_PNG="$SOURCE_DIR/icon.png"
else
    # Find any PNG file in the directory
    SOURCE_PNG=$(find "$SOURCE_DIR" -name "*.png" -type f | head -n 1)
fi

if [ -z "$SOURCE_PNG" ]; then
    echo -e "${RED}❌ No PNG file found in $SOURCE_DIR${NC}"
    echo -e "${YELLOW}💡 Please add your app icon as 'app-icon.png' in the $SOURCE_DIR directory${NC}"
    echo -e "${YELLOW}   Recommended size: 1024x1024 pixels or higher${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found source icon: $SOURCE_PNG${NC}"

# Check source image dimensions
SOURCE_INFO=$(identify "$SOURCE_PNG")
echo -e "${BLUE}📏 Source image info: $SOURCE_INFO${NC}"

# Function to create rounded corners mask
create_rounded_mask() {
    local size=$1
    local output=$2
    local radius=$3
    
    convert -size ${size}x${size} xc:none \
        -fill white \
        -draw "roundrectangle 0,0 $((size-1)),$((size-1)) $radius,$radius" \
        "$output"
}

# Function to generate icon with rounded corners
generate_icon() {
    local size=$1
    local output_name=$2
    local corner_radius=$3
    
    echo -e "${YELLOW}🔄 Generating ${size}x${size} icon...${NC}"
    
    # Create temporary mask
    local mask_file="/tmp/mask_${size}.png"
    create_rounded_mask $size "$mask_file" $corner_radius
    
    # Generate the icon
    convert "$SOURCE_PNG" \
        -resize ${size}x${size} \
        -gravity center \
        -extent ${size}x${size} \
        "$mask_file" \
        -alpha off \
        -compose CopyOpacity \
        -composite \
        "$OUTPUT_DIR/$output_name"
    
    # Clean up mask
    rm "$mask_file"
    
    echo -e "${GREEN}✅ Created: $OUTPUT_DIR/$output_name${NC}"
}

# macOS Icon sizes and their rounded corner radii (following Apple's guidelines)
# The radius is approximately 22.37% of the icon size for macOS Big Sur+ style

echo -e "${BLUE}🚀 Generating all required icon sizes...${NC}"

# Standard macOS app icon sizes with proper corner radii
generate_icon 1024 "1024x1024@2x.png" 230    # 22.46% radius
generate_icon 512 "512x512@2x.png" 115       # 22.46% radius  
generate_icon 512 "512x512.png" 115          # 22.46% radius
generate_icon 256 "256x256@2x.png" 57        # 22.27% radius
generate_icon 256 "256x256.png" 57           # 22.27% radius
generate_icon 128 "128x128@2x.png" 29        # 22.66% radius
generate_icon 128 "128x128.png" 29           # 22.66% radius
generate_icon 64 "64x64@2x.png" 14           # 21.88% radius
generate_icon 64 "64x64.png" 14              # 21.88% radius
generate_icon 32 "32x32@2x.png" 7            # 21.88% radius
generate_icon 32 "32x32.png" 7               # 21.88% radius
generate_icon 16 "16x16@2x.png" 4            # 25% radius (minimum for small sizes)
generate_icon 16 "16x16.png" 4               # 25% radius (minimum for small sizes)

# Additional sizes for comprehensive coverage
generate_icon 1024 "icon.png" 230            # Main icon
generate_icon 256 "Square284x284Logo.png" 57 # Windows Store (if needed)
generate_icon 128 "Square150x150Logo.png" 29 # Windows Store (if needed)
generate_icon 64 "Square44x44Logo.png" 14    # Windows Store (if needed)

# Step 5: Create ICNS file for macOS
echo -e "${BLUE}🍎 Creating macOS ICNS file...${NC}"

# Create iconset directory
ICONSET_DIR="/tmp/AppIcon.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# Copy icons with proper naming for iconutil
cp "$OUTPUT_DIR/16x16.png" "$ICONSET_DIR/icon_16x16.png"
cp "$OUTPUT_DIR/16x16@2x.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$OUTPUT_DIR/32x32.png" "$ICONSET_DIR/icon_32x32.png"
cp "$OUTPUT_DIR/32x32@2x.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$OUTPUT_DIR/128x128.png" "$ICONSET_DIR/icon_128x128.png"
cp "$OUTPUT_DIR/128x128@2x.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$OUTPUT_DIR/256x256.png" "$ICONSET_DIR/icon_256x256.png"
cp "$OUTPUT_DIR/256x256@2x.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$OUTPUT_DIR/512x512.png" "$ICONSET_DIR/icon_512x512.png"
cp "$OUTPUT_DIR/512x512@2x.png" "$ICONSET_DIR/icon_512x512@2x.png"

# Create ICNS file
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_DIR/icon.icns"

# Clean up
rm -rf "$ICONSET_DIR"

echo -e "${GREEN}✅ Created: $OUTPUT_DIR/icon.icns${NC}"

echo -e "${GREEN}🎉 Icon generation complete!${NC}"
echo ""
echo -e "${BLUE}📁 Generated icons in: $OUTPUT_DIR${NC}"
ls -la "$OUTPUT_DIR" | grep -E '\.(png|icns)$'

echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "1. Update your tauri.conf.json to reference the new icons"
echo -e "2. The main icon.png (1024x1024) will be used as your app icon"
echo -e "3. All sizes follow Apple's rounded corner guidelines"

# Create a simple README for the icons
cat > "$OUTPUT_DIR/README.md" << EOF
# App Icons

This directory contains all the generated app icons for the DSA Learning App.

## Generated Icons

All icons have been generated with proper rounded corners following Apple's design guidelines:

### macOS Icons
- **1024x1024@2x.png** - Retina display app icon
- **512x512@2x.png** - Retina display medium icon  
- **512x512.png** - Standard medium icon
- **256x256@2x.png** - Retina display small icon
- **256x256.png** - Standard small icon
- **128x128@2x.png** - Retina display mini icon
- **128x128.png** - Standard mini icon
- **64x64@2x.png** - Retina display tiny icon
- **64x64.png** - Standard tiny icon
- **32x32@2x.png** - Retina display micro icon
- **32x32.png** - Standard micro icon
- **16x16@2x.png** - Retina display nano icon
- **16x16.png** - Standard nano icon

### Main Icon
- **icon.png** - Main 1024x1024 icon used by Tauri

## Rounded Corners

All icons use rounded corners with radii approximately 22.37% of their size, following Apple's Big Sur+ design language:

- 1024px → 230px radius
- 512px → 115px radius  
- 256px → 57px radius
- 128px → 29px radius
- 64px → 14px radius
- 32px → 7px radius
- 16px → 4px radius

## Usage

These icons are automatically referenced in your \`tauri.conf.json\` file and will be used when building your application.

Generated on: $(date)
EOF

echo -e "${GREEN}✅ README.md created in icons directory${NC}"
echo ""
echo -e "${BLUE}🔧 Your app icons are ready with beautiful rounded corners!${NC}"