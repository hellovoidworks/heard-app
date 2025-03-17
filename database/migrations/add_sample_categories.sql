-- Add sample categories if none exist
INSERT INTO categories (name, description)
SELECT 'Personal Growth', 'Letters about personal development, self-improvement, and life lessons'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Personal Growth');

INSERT INTO categories (name, description)
SELECT 'Mental Health', 'Share experiences and support related to mental health and wellbeing'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Mental Health');

INSERT INTO categories (name, description)
SELECT 'Relationships', 'Discuss family, friendships, romantic relationships, and interpersonal dynamics'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Relationships');

INSERT INTO categories (name, description)
SELECT 'Career & Work', 'Letters about professional life, career challenges, and workplace experiences'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Career & Work');

INSERT INTO categories (name, description)
SELECT 'Life Advice', 'Seeking or offering guidance on life decisions and challenges'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Life Advice');

INSERT INTO categories (name, description)
SELECT 'Gratitude', 'Express appreciation and thankfulness for people or experiences'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Gratitude');

INSERT INTO categories (name, description)
SELECT 'Creativity', 'Share creative writing, poetry, art, and other forms of expression'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Creativity');

INSERT INTO categories (name, description)
SELECT 'Inspiration', 'Uplifting stories and messages to inspire others'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Inspiration');

INSERT INTO categories (name, description)
SELECT 'Challenges', 'Discussing difficult times, obstacles, and how to overcome them'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Challenges');

INSERT INTO categories (name, description)
SELECT 'Reflection', 'Thoughtful contemplation on past experiences and lessons learned'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Reflection'); 