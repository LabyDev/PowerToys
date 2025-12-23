import os
import random
from os import startfile
from os import path
'''
    For the given path, get the List of all files in the directory tree 
'''
def getListOfFiles(dirName):
    # create a list of file and sub directories 
    # names in the given directory 
    fileName = os.path.basename(__file__)
    listOfFile = os.listdir(dirName)
    allFiles = list()
    # Iterate over all the entries
    for entry in listOfFile:
        # Create full path
        fullPath = os.path.join(dirName, entry)

        # If entry is a directory then get the list of files in this directory 
        if os.path.isdir(fullPath):
            allFiles = allFiles + getListOfFiles(fullPath)
        else:
            if (entry == fileName):
                break
            else:
                allFiles.append(fullPath)   
    return allFiles        
def main():
    
    dirName = os.path.dirname(os.path.realpath(__file__))
    dir_path = os.path.dirname(os.path.realpath(__file__))
    cacheName = "Cache.txt"
    cachePath = os.path.join(dir_path, cacheName)
    path_script = os.path.realpath(__file__)

    if path.exists(cacheName):
        NewListOfFiles = []
        with open(cacheName, 'r', encoding='utf-8') as f:
            listOfFiles = f.readlines()
        for element in listOfFiles:
            NewListOfFiles.append(element.strip())
        f.close
        print("Cache detected. Choosing from cache...")
        print("***")
        random.shuffle(NewListOfFiles)
        choosefile = random.choice(NewListOfFiles)
        # print(choosefile)
        startfile(choosefile)
        # Update de cache met de nieuwe geshuffelde lijst
        with open(cachePath, 'w', encoding='utf-8') as f:
            for elem in NewListOfFiles:
                f.write(elem + "\n")
        quit()

    # Get the list of all files in directory tree at given path
    listOfFiles = getListOfFiles(dirName)

    f = open(cacheName, "w", encoding='utf-8')
    
    # Print the files
    for elem in listOfFiles:
        print(elem)
    print ("****************")
    
    # Get the list of all files in directory tree at given path
    listOfFiles = list()
    removed = 0
    for (dirpath, dirnames, filenames) in os.walk(dirName):
        listOfFiles += [os.path.join(dirpath, file) for file in filenames]
        if removed == 0:
            listOfFiles.remove(path_script)
            listOfFiles.remove(cachePath)
            removed = 1
    
    print("Shuffle time!")
    random.shuffle(listOfFiles)
    random.shuffle(listOfFiles)
    random.shuffle(listOfFiles)
    random.shuffle(listOfFiles)
    random.shuffle(listOfFiles)
    random.shuffle(listOfFiles)

    # Print the files    
    for elem in listOfFiles:
        print(elem)    
        f.write(elem + "\n")
    f.close
    print("***")
    choosefile = random.choice(listOfFiles)
    print(choosefile)
    startfile(choosefile)
        
        
        
if __name__ == '__main__':
    main()