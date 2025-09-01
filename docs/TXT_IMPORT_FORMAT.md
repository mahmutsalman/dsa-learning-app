# TXT Problem Import Format Specification

## Overview
The TXT import system allows bulk import of coding problems from structured text files. This document defines the format specification and provides examples.

## File Format Structure

### Problem Delimiter
Each problem in the file is separated by `---` on its own line.

### Required Fields
- **Title**: `# Title: [Problem Title]`
- **Description**: `# Description:` followed by the problem description
- **Difficulty**: `# Difficulty: Easy|Medium|Hard`

### Optional Fields
- **Topics**: `# Topics: [comma-separated topics]`
- **Tags**: `# Tags: [comma-separated tags]`
- **LeetCode URL**: `# LeetCode URL: [URL]`
- **Constraints**: `# Constraints:` followed by bullet points or numbered list
- **Hints**: `# Hints:` followed by bullet points or numbered list
- **Related Problems**: `# Related: [comma-separated problem titles or IDs]`

## Format Example

```txt
# Title: Two Sum
# Difficulty: Easy
# Topics: Array, Hash Table
# Tags: leetcode, beginner, interview
# LeetCode URL: https://leetcode.com/problems/two-sum/
# Description:
Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

# Constraints:
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists

# Hints:
- A really brute force way would be to search for all possible pairs of numbers but that would be too slow
- Again, the best way to approach this problem is with a HashMap or Dictionary
- Use a hash table to store the numbers you've seen so far and their indices

---

# Title: Valid Parentheses
# Difficulty: Easy
# Topics: String, Stack
# Tags: leetcode, stack, string-matching
# Description:
Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

# Constraints:
- 1 <= s.length <= 10^4
- s consists of parentheses only '()[]{}'

# Hints:
- Use a stack data structure
- When you encounter an opening bracket, push it onto the stack
- When you encounter a closing bracket, check if it matches the most recent opening bracket

---
```

## Parsing Rules

### Field Parsing
1. **Case Insensitive Headers**: Field names are case-insensitive (`# title:` = `# Title:` = `# TITLE:`)
2. **Whitespace Handling**: Leading/trailing whitespace is trimmed from all values
3. **Multi-line Content**: Description, Constraints, and Hints can span multiple lines until next field or delimiter
4. **List Parsing**: 
   - Topics and Tags: Split by comma, trim whitespace
   - Constraints and Hints: Each line starting with `-` or digit becomes a list item

### Data Validation
1. **Required Field Check**: Title, Description, and Difficulty must be present
2. **Difficulty Values**: Must be exactly "Easy", "Medium", or "Hard" (case-insensitive)
3. **URL Validation**: LeetCode URLs must be valid HTTP/HTTPS URLs
4. **Length Limits**: 
   - Title: max 200 characters
   - Description: max 5000 characters
   - Individual constraints/hints: max 500 characters each

### Error Handling
1. **Missing Required Fields**: Skip problem with detailed error message
2. **Invalid Difficulty**: Default to "Medium" with warning
3. **Malformed URLs**: Skip URL field with warning
4. **Duplicate Titles**: Append number suffix to make unique
5. **Empty Problems**: Skip entirely with warning

## Import Process
1. **File Upload**: User selects .txt file through drag-and-drop or file picker
2. **Client Parsing**: Frontend parses file and validates basic structure
3. **Preview**: Show parsed problems for user review
4. **Server Import**: Send validated problems to Rust backend for database insertion
5. **Progress Tracking**: Real-time updates on import progress
6. **Results Summary**: Show success/failure count with detailed error log
